export type Profile = 'balanced' | 'safe' | 'minimal' | 'yolo'
export type InstallMode = 'recommended' | 'manual'
export type ProfilesAction = 'add' | 'overwrite' | 'skip'
export type ReasoningChoice = 'on' | 'off'
export type NotifyAction = 'yes' | 'no'
export type GlobalAgentsAction = 'create-default' | 'overwrite-default' | 'append-default' | 'skip'
export type InstallNodeMethod = 'nvm' | 'brew' | 'skip'
export type PackageManager = 'brew' | 'apt' | 'dnf' | 'pacman' | 'zypper' | 'none'

export interface InstallerOptions {
  profilesAction: ProfilesAction
  reasoning: ReasoningChoice
  notify: NotifyAction | undefined
  globalAgents: GlobalAgentsAction | undefined
  notificationSound?: string | undefined // 'none' to disable
  mode: InstallMode
  installNode: InstallNodeMethod
  shell: string
  vscodeId: string | undefined
  noVscode: boolean
  agentsMd: string | undefined
  dryRun: boolean
  assumeYes: boolean
  skipConfirmation: boolean
}

export interface InstallerContext {
  cwd: string
  homeDir: string
  rootDir: string
  logDir: string
  logFile: string
  options: InstallerOptions
  logger: Logger
}

export interface Logger {
  log: (msg: string) => void
  info: (msg: string) => void
  ok: (msg: string) => void
  warn: (msg: string) => void
  err: (msg: string) => void
}
