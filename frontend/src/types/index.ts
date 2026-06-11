export interface ScoreSchema {
  role_clarity: number
  context_richness: number
  task_specificity: number
  output_definition: number
  model_alignment: number
}

export interface GenerateResponse {
  prompt: string
  scores: ScoreSchema
  composite_score: number
  techniques: string[]
  tips: string[]
  prompt_id?: string
}

export interface UpgradeResponse extends GenerateResponse {
  before_scores: ScoreSchema
  before_composite: number
  improvements: string[]
}

export interface UserProfile {
  role: string
  domain: string
  experience: string
  task: string
  constraints?: string
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface User {
  id: string
  email: string
  role: string
}

export interface HistoryItem {
  id: string
  mode: string
  prompt_preview: string
  composite_score: number
  created_at: string
}
