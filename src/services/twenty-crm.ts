/**
 * Twenty CRM GraphQL client — интеграция звонков Mango → Twenty (we.deshiki.ru)
 *
 * Каждый звонок создаёт Note с prefix [CALL] в title, привязанную через NoteTarget.
 * Новый контакт → Person + Opportunity + Note (привязана к обоим).
 * Существующий контакт → Note привязана к Person (+ Opportunity если есть, новая НЕ создаётся).
 */

const TWENTY_API_URL = process.env.TWENTY_API_URL || 'https://we.deshiki.ru/graphql'
const TWENTY_API_TOKEN = process.env.TWENTY_API_TOKEN || ''
const CRM_BASE_URL = process.env.CRM_BASE_URL || 'https://deshiki.ru'

// --- Types ---

interface GqlResponse<T = any> {
  data?: T
  errors?: Array<{ message: string }>
}

/** Данные о звонке, передаваемые из mango.ts */
export interface CallInfo {
  direction: 'IN' | 'OUT'
  phone: string
  duration: number
  status: string
  mangoCallId: string
  entryId?: string
  recordingUrl?: string
}

// --- GraphQL client ---

async function gql<T = any>(query: string, variables?: Record<string, any>): Promise<T> {
  const maxRetries = 2
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(TWENTY_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${TWENTY_API_TOKEN}`,
        },
        body: JSON.stringify({ query, variables }),
      })

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`Twenty API ${res.status}: ${text.slice(0, 300)}`)
      }

      const json: GqlResponse<T> = await res.json()
      if (json.errors?.length) {
        throw new Error(`Twenty GQL: ${json.errors[0].message}`)
      }
      return json.data!
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)))
        console.log(`[twenty] Retry ${attempt + 1}...`)
      }
    }
  }
  throw lastError!
}

/** Превращает относительный URL записи в полный */
function fullRecordingUrl(url: string): string {
  if (url.startsWith('http')) return url
  return `${CRM_BASE_URL}${url}`
}

// --- Phone normalization ---

/** Убираем +7/8, оставляем 10 цифр */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 11 && (digits.startsWith('7') || digits.startsWith('8'))) {
    return digits.slice(1)
  }
  if (digits.length === 10) return digits
  return digits
}

// --- CRUD для Twenty объектов ---

/** Поиск Person по номеру телефона */
export async function findPersonByPhone(phone: string): Promise<{ id: string; firstName: string; lastName: string } | null> {
  const normalized = normalizePhone(phone)
  const data = await gql<{
    people: { edges: Array<{ node: { id: string; name: { firstName: string; lastName: string } } }> }
  }>(`
    query FindPerson($phone: String!) {
      people(filter: { phones: { primaryPhoneNumber: { like: $phone } } }) {
        edges { node { id name { firstName lastName } } }
      }
    }
  `, { phone: `%${normalized}%` })

  const node = data.people.edges[0]?.node
  if (!node) return null
  return { id: node.id, firstName: node.name.firstName, lastName: node.name.lastName }
}

/** Создание Person с телефоном */
export async function createPerson(phone: string): Promise<string> {
  const normalized = normalizePhone(phone)
  const data = await gql<{ createPerson: { id: string } }>(`
    mutation CreatePerson($firstName: String!, $lastName: String!, $phone: String!) {
      createPerson(data: {
        name: { firstName: $firstName, lastName: $lastName }
        phones: { primaryPhoneNumber: $phone, primaryPhoneCountryCode: "RU" }
      }) { id }
    }
  `, { firstName: 'Звонок', lastName: normalized, phone: normalized })

  return data.createPerson.id
}

/** Поиск Opportunities по pointOfContactId */
export async function findOpportunitiesByPersonId(personId: string): Promise<Array<{ id: string; name: string; stage: string }>> {
  const data = await gql<{
    opportunities: { edges: Array<{ node: { id: string; name: string; stage: string } }> }
  }>(`
    query FindOpps($personId: UUID!) {
      opportunities(filter: { pointOfContactId: { eq: $personId } }) {
        edges { node { id name stage } }
      }
    }
  `, { personId })

  return data.opportunities.edges.map(e => e.node)
}

/** Создание Opportunity (стадия NOVYY) */
export async function createOpportunity(personId: string, title: string): Promise<string> {
  const data = await gql<{ createOpportunity: { id: string } }>(`
    mutation CreateOpp($name: String!, $personId: ID!) {
      createOpportunity(data: {
        name: $name
        stage: NOVYY
        pointOfContactId: $personId
      }) { id }
    }
  `, { name: title, personId })

  return data.createOpportunity.id
}

// --- Дедупликация ---

/**
 * Поиск существующей Note по mangoCallId.
 * Ищет в bodyV2.markdown строку с Mango ID.
 */
export async function findCallNoteByMangoId(mangoCallId: string): Promise<{ id: string; title: string; markdown: string } | null> {
  const data = await gql<{
    notes: { edges: Array<{ node: { id: string; title: string; bodyV2: { markdown: string } } }> }
  }>(`
    query FindCallNote($titlePattern: String!, $bodyPattern: String!) {
      notes(
        filter: {
          and: [
            { title: { like: $titlePattern } }
            { bodyV2: { markdown: { like: $bodyPattern } } }
          ]
        }
        first: 1
      ) {
        edges { node { id title bodyV2 { markdown } } }
      }
    }
  `, {
    titlePattern: '%[CALL]%',
    bodyPattern: `%${mangoCallId}%`,
  })

  const node = data.notes.edges[0]?.node
  if (!node) return null
  return { id: node.id, title: node.title, markdown: node.bodyV2?.markdown || '' }
}

// --- Note creation & update ---

/**
 * Создать Note для звонка и привязать к Person (и Opportunity если есть).
 * Title: [CALL] Входящий звонок: 2 мин 30 сек
 * Body: markdown с деталями звонка
 */
export async function addCallNote(
  personId: string,
  opportunityId: string | null,
  info: CallInfo,
): Promise<string> {
  const dirText = info.direction === 'IN' ? 'Входящий' : 'Исходящий'
  const mins = Math.floor(info.duration / 60)
  const secs = info.duration % 60
  const durationText = info.duration > 0 ? `${mins} мин ${secs} сек` : 'не состоялся'
  const normalized = normalizePhone(info.phone)

  const title = `[CALL] ${dirText} звонок: ${durationText}`

  const lines = [
    `**Телефон:** +7${normalized}`,
    `**Направление:** ${dirText}`,
    `**Статус:** ${info.status}`,
    `**Длительность:** ${durationText}`,
    `**Mango ID:** ${info.mangoCallId}`,
  ]
  if (info.recordingUrl) {
    const url = fullRecordingUrl(info.recordingUrl)
    lines.push(`**Запись:** [Прослушать](${url})`)
  }
  const markdown = lines.join('\n\n')

  // 1. Создаём Note с markdown bodyV2
  const noteData = await gql<{ createNote: { id: string } }>(`
    mutation CreateNote($title: String!, $markdown: String!) {
      createNote(data: {
        title: $title
        bodyV2: { markdown: $markdown }
      }) { id }
    }
  `, { title, markdown })

  const noteId = noteData.createNote.id
  console.log(`[twenty] Created Note ${noteId}: "${title}"`)

  // 2. Привязываем к Person через NoteTarget
  await gql(`
    mutation LinkNoteToPerson($noteId: ID!, $personId: ID!) {
      createNoteTarget(data: {
        noteId: $noteId
        targetPersonId: $personId
      }) { id }
    }
  `, { noteId, personId })

  // 3. Привязываем к Opportunity через NoteTarget (если есть)
  if (opportunityId) {
    await gql(`
      mutation LinkNoteToOpp($noteId: ID!, $oppId: ID!) {
        createNoteTarget(data: {
          noteId: $noteId
          targetOpportunityId: $oppId
        }) { id }
      }
    `, { noteId, oppId: opportunityId })
    console.log(`[twenty] Linked Note -> Person ${personId} + Opp ${opportunityId}`)
  } else {
    console.log(`[twenty] Linked Note -> Person ${personId} (no Opportunity)`)
  }
  return noteId
}

/**
 * Обновить существующую Note: дописать URL записи.
 */
export async function updateNoteWithRecording(noteId: string, currentMarkdown: string, recordingUrl: string): Promise<void> {
  const url = fullRecordingUrl(recordingUrl)
  const newMarkdown = currentMarkdown + `\n\n**Запись:** [Прослушать](${url})`

  await gql(`
    mutation UpdateNote($noteId: UUID!, $markdown: String!) {
      updateNote(id: $noteId, data: {
        bodyV2: { markdown: $markdown }
      }) { id }
    }
  `, { noteId, markdown: newMarkdown })

  console.log(`[twenty] Updated Note ${noteId} with recording URL`)
}

// --- Main sync functions ---

/**
 * Главная функция: при Disconnected записать звонок в Twenty CRM.
 * Fire-and-forget из mango.ts.
 */
export async function syncCallToTwenty(info: CallInfo): Promise<void> {
  if (!TWENTY_API_TOKEN) {
    console.log('[twenty] Skipped — no API token')
    return
  }

  const normalized = normalizePhone(info.phone)
  console.log(`[twenty] Syncing call ${info.mangoCallId} for +7${normalized}...`)

  try {
    // 1. Дедупликация
    const existingNote = await findCallNoteByMangoId(info.mangoCallId)
    if (existingNote) {
      console.log(`[twenty] Call ${info.mangoCallId} already synced (Note ${existingNote.id}), skipping`)
      // Если есть запись а в Note её нет — обновляем
      if (info.recordingUrl && !existingNote.markdown.includes('Запись:')) {
        await updateNoteWithRecording(existingNote.id, existingNote.markdown, info.recordingUrl)
      }
      return
    }

    // 2. Ищем / создаём Person
    let person = await findPersonByPhone(info.phone)
    let personId: string
    const isNewContact = !person

    if (isNewContact) {
      personId = await createPerson(info.phone)
      console.log(`[twenty] Created Person ${personId}`)
    } else {
      personId = person.id
      console.log(`[twenty] Found Person ${personId} (${person.firstName} ${person.lastName})`)
    }

    // 3. Opportunity: создаём ТОЛЬКО для новых контактов, для существующих — ищем имеющуюся
    let opportunityId: string | null = null

    if (isNewContact) {
      // Новый контакт → создаём сделку
      const dirText = info.direction === 'IN' ? 'Входящий' : 'Исходящий'
      opportunityId = await createOpportunity(personId, `${dirText} звонок: +7${normalized}`)
      console.log(`[twenty] Created Opportunity ${opportunityId}`)
    } else {
      // Существующий контакт → ищем имеющуюся сделку (не создаём новую)
      const opps = await findOpportunitiesByPersonId(personId)
      if (opps.length > 0) {
        const activeOpp = opps.find(o => o.stage !== 'KUPIL') || opps[0]
        opportunityId = activeOpp.id
        console.log(`[twenty] Using existing Opportunity ${opportunityId} (${activeOpp.name})`)
      } else {
        console.log(`[twenty] Existing contact has no Opportunity, Note linked to Person only`)
      }
    }

    // 4. Создаём Note, привязываем к Person (+ Opportunity если есть)
    const noteId = await addCallNote(personId, opportunityId, info)
    console.log(`[twenty] Done: call ${info.mangoCallId} -> Note ${noteId}`)

  } catch (err) {
    console.error('[twenty] Error syncing call:', err instanceof Error ? err.message : err)
  }
}

/**
 * Синхронизация записи разговора в Twenty CRM.
 * Ищет существующую Note по mangoCallId → обновляет.
 * Если Note не найдена → создаёт полную Note с записью.
 */
export async function syncRecordingToTwenty(info: CallInfo): Promise<void> {
  if (!TWENTY_API_TOKEN) return

  console.log(`[twenty] Syncing recording for call ${info.mangoCallId}...`)

  try {
    // Ищем существующую Note
    const existingNote = await findCallNoteByMangoId(info.mangoCallId)

    if (existingNote) {
      if (existingNote.markdown.includes('Запись:')) {
        console.log(`[twenty] Note ${existingNote.id} already has recording, skipping`)
        return
      }
      await updateNoteWithRecording(existingNote.id, existingNote.markdown, info.recordingUrl!)
      return
    }

    // Note не найдена — создаём полную (с записью)
    console.log(`[twenty] No Note for call ${info.mangoCallId}, creating full Note with recording`)
    await syncCallToTwenty(info)

  } catch (err) {
    console.error('[twenty] Error syncing recording:', err instanceof Error ? err.message : err)
  }
}

// --- Транскрибация: обновление Twenty CRM ---

import type { TranscriptionAnalysis } from './transcription'

/** Обновить имя Person (напр. "Звонок 9017994549" → "Иван Петров") */
export async function updatePersonName(personId: string, firstName: string, lastName: string): Promise<void> {
  await gql(`
    mutation UpdatePerson($id: UUID!, $firstName: String!, $lastName: String!) {
      updatePerson(id: $id, data: {
        name: { firstName: $firstName, lastName: $lastName }
      }) { id }
    }
  `, { id: personId, firstName, lastName })

  console.log(`[twenty] Updated Person ${personId} name: ${firstName} ${lastName}`)
}

/** Обновить название Opportunity */
export async function updateOpportunityName(oppId: string, name: string): Promise<void> {
  await gql(`
    mutation UpdateOpp($id: UUID!, $name: String!) {
      updateOpportunity(id: $id, data: { name: $name }) { id }
    }
  `, { id: oppId, name })

  console.log(`[twenty] Updated Opportunity ${oppId} name: "${name}"`)
}

/** Обновить Opportunity: температура клиента и сумма сделки */
export async function updateOpportunityFields(oppId: string, fields: {
  clientTemperature?: string
  amount?: number
}): Promise<void> {
  // Температура клиента
  if (fields.clientTemperature) {
    await gql(`
      mutation UpdateOppTemp($id: UUID!, $temp: OpportunityClientTemperatureEnum!) {
        updateOpportunity(id: $id, data: { clientTemperature: $temp }) { id }
      }
    `, { id: oppId, temp: fields.clientTemperature })
    console.log(`[twenty] Updated Opportunity ${oppId} temperature: ${fields.clientTemperature}`)
  }

  // Сумма сделки
  if (fields.amount && fields.amount > 0) {
    await gql(`
      mutation UpdateOppAmount($id: UUID!, $amountMicros: BigFloat!, $currency: String!) {
        updateOpportunity(id: $id, data: { amount: { amountMicros: $amountMicros, currencyCode: $currency } }) { id }
      }
    `, { id: oppId, amountMicros: fields.amount * 1000000, currency: 'RUB' })
    console.log(`[twenty] Updated Opportunity ${oppId} amount: ${fields.amount} RUB`)
  }
}

/** Создать Note [AI] с результатами анализа звонка */
export async function addTranscriptionNote(
  personId: string,
  opportunityId: string | null,
  analysis: TranscriptionAnalysis,
): Promise<string> {
  const clientLabel = analysis.clientName || 'Неизвестный'
  const tempEmoji = analysis.clientTemperature === 'HOT' ? '🟢' : analysis.clientTemperature === 'COLD' ? '🔴' : '🟠'
  const tempLabel = analysis.clientTemperature === 'HOT' ? 'Тёплый' : analysis.clientTemperature === 'COLD' ? 'Холодный' : 'Дожим'
  const title = `[AI] ${tempEmoji} ${clientLabel}`

  const lines = [
    `**Клиент:** ${clientLabel}`,
    `**Оценка:** ${tempEmoji} ${tempLabel}`,
    `**Резюме:** ${analysis.summary}`,
  ]
  if (analysis.agreements) {
    lines.push(`**Договорённости:** ${analysis.agreements}`)
  }
  if (analysis.tariff) {
    lines.push(`**Тариф:** ${analysis.tariff}`)
  }
  if (analysis.dealAmount > 0) {
    lines.push(`**Сумма сделки:** ${analysis.dealAmount.toLocaleString('ru-RU')} ₽`)
  }
  if (analysis.meetingDateTime) {
    lines.push(`**Встреча:** ${analysis.meetingDateTime}`)
  }
  lines.push(`**Тональность:** ${analysis.sentiment}`)
  if (analysis.keywords.length > 0) {
    lines.push(`**Ключевые слова:** ${analysis.keywords.join(', ')}`)
  }
  const markdown = lines.join('\n\n')

  const noteData = await gql<{ createNote: { id: string } }>(`
    mutation CreateNote($title: String!, $markdown: String!) {
      createNote(data: {
        title: $title
        bodyV2: { markdown: $markdown }
      }) { id }
    }
  `, { title, markdown })

  const noteId = noteData.createNote.id

  // Привязка к Person
  await gql(`
    mutation LinkNoteToPerson($noteId: ID!, $personId: ID!) {
      createNoteTarget(data: {
        noteId: $noteId
        targetPersonId: $personId
      }) { id }
    }
  `, { noteId, personId })

  // Привязка к Opportunity (если есть)
  if (opportunityId) {
    await gql(`
      mutation LinkNoteToOpp($noteId: ID!, $oppId: ID!) {
        createNoteTarget(data: {
          noteId: $noteId
          targetOpportunityId: $oppId
        }) { id }
      }
    `, { noteId, oppId: opportunityId })
  }

  console.log(`[twenty] Created AI Note ${noteId}: "${title}"`)
  return noteId
}

/**
 * Главная функция: после транскрибации обновить Twenty CRM.
 * Обновляет имя Person, название Opportunity, создаёт Note [AI].
 */
export async function updateTwentyFromTranscription(
  call: { phone: string; mangoCallId?: string | null; direction?: string | null },
  analysis: TranscriptionAnalysis,
): Promise<void> {
  if (!TWENTY_API_TOKEN) return

  try {
    // 1. Найти Person
    const person = await findPersonByPhone(call.phone)
    if (!person) {
      console.log(`[twenty] Person not found for ${call.phone}, skipping AI update`)
      return
    }

    // 2. Обновить имя Person (если GPT извлёк имя И текущее = "Звонок")
    if (analysis.clientName && person.firstName === 'Звонок') {
      const nameParts = analysis.clientName.trim().split(/\s+/)
      const firstName = nameParts[0]
      const lastName = nameParts.slice(1).join(' ') || ''
      await updatePersonName(person.id, firstName, lastName)
    }

    // 3. Найти Opportunity
    const opps = await findOpportunitiesByPersonId(person.id)
    const opp = opps.find(o => o.stage !== 'KUPIL') || opps[0] || null

    // 4. Обновить название Opportunity (только имя клиента)
    if (opp && analysis.clientName) {
      await updateOpportunityName(opp.id, analysis.clientName)
    }

    // 5. Обновить температуру клиента и сумму сделки
    if (opp) {
      await updateOpportunityFields(opp.id, {
        clientTemperature: analysis.clientTemperature,
        amount: analysis.dealAmount,
      })
    }

    // 6. Создать Note [AI] с резюме
    await addTranscriptionNote(person.id, opp?.id || null, analysis)

    console.log(`[twenty] AI update done for ${call.phone}`)
  } catch (err) {
    console.error('[twenty] Error updating from transcription:', err instanceof Error ? err.message : err)
  }
}
