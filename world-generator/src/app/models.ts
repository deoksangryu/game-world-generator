export interface WorldInput {
  gameTitle: string;
  genre: string;
  basicSetting: string;
  mainConflict: string;
  uniqueElements: string;
}

export interface GameWorld {
  expandedWorldDescription: string;
  theme: string;
  setting: string;
}

export interface HistoryEra {
  id: string;
  type: string;
  title: string;
  date: string;
  description: string;
  tags: string[];
  related: {
    npcs: string[];
    monsters: string[];
  };
  see_also: string[];
}

export interface NPCProfile {
  id: string;
  name: string;
  species: string;
  gender: string;
  age: number;
  affiliation: string;
  temper?: string;
  personality: string;
  background?: string;
  knowledge?: string[];
  role?: string;
  skills: string[];
  quests?: string[];
  level_requirement: number;
  intimacy_requirement?: number;
  location?: string;
  appearance_features?: string;
  imageUrl?: string;
  voiceUrl?: string;
}

export interface WorldGenerationRequest {
  theme: string;
  setting: string;
  conflict: string;
  unique_elements: string;
  use_search?: boolean;
}

export interface WorldGenerationResponse {
  success: boolean;
  message: string;
  world_data?: {
    world: GameWorld;
    lore: HistoryEra[];
    npcs: NPCProfile[];
  };
  generation_time?: number;
  error?: string;
}

export interface ServerStatus {
  status: string;
  message: string;
  uptime: string;
  world_service_ready: boolean;
  npc_service_ready: boolean;
  stats: {
    total_requests: number;
    world_generations: number;
    npc_generations: number;
    full_generations: number;
    start_time: string;
  };
}

export interface FullGenerationRequest {
  world_request: WorldGenerationRequest;
  generate_npc_images: boolean;
  max_npc_images: number;
}

export interface FullGenerationResponse {
  success: boolean;
  message: string;
  world_data?: {
    world: GameWorld;
    lore: HistoryEra[];
    npcs: NPCProfile[];
  };
  npc_images: Array<{
    npc_id: string;
    name: string;
    image_url: string;
    image_path: string;
  }>;
  generation_time: number;
  world_generation_time?: number;
  npc_generation_time?: number;
} 