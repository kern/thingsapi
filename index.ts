import fetch from 'node-fetch'
import qs from 'qs'
import uuid from 'uuid'
import moment from 'moment'

const API_BASE_URL = 'https://thingscloud.appspot.com/version/1/history'

type CreateTodoDestination = 'inbox' | 'today' | 'scheduled'

type CreateTodoOptions = {
  title?: string,
  dueDate?: string,
  scheduled?: string,
  note?: string,
  aorId?: string,
  destination?: CreateTodoDestination
  checklist?: Array<string>
}

class ThingsAPIClient {
  accountId: string

  constructor(accountId: string) {
    this.accountId = accountId
  }

  constructURL(path: string, query: object = {}) {
    return `${API_BASE_URL}/${this.accountId}${path}?${qs.stringify(query)}`
  }

  async performGetRequest(path: string, query: object = {}) {
    const url = this.constructURL(path, query)
    const req = await fetch(url)
    return req.json()
  }

  async performPostRequest(path: string, body: object) {
    const url = this.constructURL(path, {})
    const req = await fetch(url, {
      method: 'POST',
      headers: {
          'User-Agent': 'ThingsMac/20808500mas (x86_64; OS X 10.12.2; en_DK)',
          'Content-Type': 'application/json; charset=UTF-8',
          'Content-Encoding': 'UTF-8'
      },
      body: JSON.stringify(body)
    })

    return req.json()
  }

  async getCurrentIndex() {
    const res = await this.performGetRequest('')
    return res['current-item-index']
  }

  async createTodoItem(options: CreateTodoOptions) {
    const currentIndex = await this.getCurrentIndex()
    const todoItem = this.constructTodoItem(options)
    const body = {
      'current-item-index': currentIndex,
      'items': [todoItem],
      'schema': 301
    }

    const res = this.performPostRequest('/items', body)
    return res
  }

  constructTodoItem(options: CreateTodoOptions) {
    const title = options.title || 'New todo'
    const scheduled = options.scheduled ? moment(moment(options.scheduled).format('YYYY-MM-DD')).unix() : null
    const dueDate = options.dueDate || null
    let note = options.note || null
    const destination = options.destination || 'inbox'
    const uid = uuid.v4().toUpperCase()
    const now = Date.now() / 1000
    const ar = options.aorId ? [options.aorId] : []

    let st
    let sr

    if (destination === 'inbox') {
      st = 0
    } else if (destination === 'today') {
      st = 1
    } else if (destination === 'scheduled') {
      st = 0
    } else {
      throw new Error('unsupported destination')
    }

    if (destination === 'today') {
      sr = moment(moment(new Date()).format('YYYY-MM-DD')).unix()
    } else if (destination === 'scheduled') {
      sr = scheduled
    } else {
      sr = null
    }

    if (note != null) {
      note = '<note xml:space=\"preserve\">' + note + '</note>'
    }

    const items: any = {
      [uid]: {
        "t": 0,
        "e": "Task3",
        "p": {
          "agr": [],
          "ar": ar,
          "ato": null,
          "dds": null,
          "lai": null,
          "sb": 0,
          "acrd": null,
          "cd": now,
          "dd": dueDate,
          "dl": [],
          "do": 0,
          "icc": 0,
          "icp": false,
          "icsd": null,
          "ix": 0,
          "md": now,
          "nt": note,
          "pr": [],
          "rr": null,
          "rt": null,
          "sp": null,
          "sr": sr,
          "ss": 0,
          "st": st,
          "tg": [],
          "ti": 0,
          "tir": sr,
          "tp": 0,
          "tr": false,
          "tt": title
        }
      }
    }

    if (options.checklist) {
      for (const c of options.checklist) {
        const cuid = uuid.v4().toUpperCase()
        items[cuid] = {
          t: 0,
          e: "ChecklistItem",
          p: {
            cd: now,
            ts: [uid],
            sp: null,
            ss: 0,
            md: now,
            tt: c,
            ix: 0
          }
        }
      }
    }

    return items
  }
}

// TODO(@kern): Create a stateful client that loads all items into a postgres db using jsonb
const client = new ThingsAPIClient(process.env.ACCOUNT_ID || '')
client.createTodoItem({
  title: 'Pick up the package at the Austin front desk',
  destination: 'today',
  aorId: process.env.AOR || undefined,
  checklist: ['foo', 'bar', 'baz']
}).then(console.log).catch(console.error)
