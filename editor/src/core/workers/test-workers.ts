import {
  createLinterRequestMessage,
  handleMessage as handleLinterMessage,
  OutgoingLinterWorkerMessage,
} from './linter/linter-worker'
import { LinterWorker, ParserPrinterWorker, WatchdogWorker } from './workers'
import { handleMessage as handleParserPrinterMessage } from './parser-printer/parser-printer-worker'
import { handleMessage as handleTSWorkerMessage } from './ts/ts-worker'
import { BundlerWorker } from './bundler-bridge'
import {
  createParsePrintFilesRequest,
  ParseOrPrint,
  ParsePrintResultMessage,
} from './common/worker-types'

export class FakeParserPrinterWorker implements ParserPrinterWorker {
  messageListeners: Array<(ev: MessageEvent) => any> = []

  addParseFileResultEventListener = (listener: (ev: MessageEvent) => any): void => {
    this.messageListeners.push(listener)
  }

  removeParseFileResultEventListener = (listener: (ev: MessageEvent) => any): void => {
    this.messageListeners = this.messageListeners.filter((l) => l !== listener)
  }

  receiveMessage = (data: ParsePrintResultMessage): void => {
    this.messageListeners.forEach((l) => {
      l(new MessageEvent('message', { data: data }))
    })
  }

  sendParsePrintMessage = (files: Array<ParseOrPrint>): void => {
    handleParserPrinterMessage(createParsePrintFilesRequest(files), this.receiveMessage)
  }
}

export class FakeLinterWorker implements LinterWorker {
  linterMessageListeners: Array<(ev: MessageEvent) => any> = []

  receiveLinterMessage = (data: OutgoingLinterWorkerMessage): void => {
    this.linterMessageListeners.forEach((l) => {
      l(new MessageEvent('message', { data: data }))
    })
  }

  sendLinterRequestMessage = (filename: string, content: string): void => {
    handleLinterMessage(createLinterRequestMessage(filename, content), this.receiveLinterMessage)
  }

  addLinterResultEventListener = (listener: (e: MessageEvent) => void): void => {
    this.linterMessageListeners.push(listener)
  }

  removeLinterResultEventListener = (listener: (e: MessageEvent) => void): void => {
    this.linterMessageListeners = this.linterMessageListeners.filter((l) => l !== listener)
  }
}

export class FakeWatchdogWorker implements WatchdogWorker {
  initWatchdogWorker(_projectID: string): void {
    // empty
  }

  sendWatchdogTerminateMessage(): void {
    // empty
  }

  addHeartbeatRequestEventListener(_handler: (e: MessageEvent) => void): void {
    // empty
  }

  sendHeartbeatResponseMessage(_id: NodeJS.Timer, _projectId: string): void {
    // empty
  }
}
