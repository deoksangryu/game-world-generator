export interface GameWorld {
  id?: string;
  originalInput?: string;
  expandedWorldDescription: string;
  theme: string;
  setting: string;
  createdAt?: Date;
}

export interface NPCProfile {
  id: string;
  name: string;
  description?: string;
  background?: string;
  personality: string;
  role: string;
  appearance?: string;
  imageUrl?: string;
  worldId?: string;
  products?: NPCProduct[];
  // 서버 모델 필드들
  species?: string;
  gender?: string;
  age?: number;
  affiliation?: string;
  temper?: string;
  knowledge?: string[];
  skills?: string[];
  quests?: string[];
  level_requirement?: number;
  intimacy_requirement?: number;
  location?: string;
  appearance_features?: string;
  // 음성 관련 필드들
  voiceUrl?: string;
  voiceActor?: string; // 선택된 음성 배우 이름
  voiceGender?: 'male' | 'female';
  voiceAge?: 'young' | 'middle' | 'old';
  voiceStyle?: string; // 음성 스타일 (예: 친근한, 위엄있는, 신비한 등)
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

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: Date;
  isUser: boolean;
}

export interface ChatSession {
  id: string;
  npcId: string;
  messages: ChatMessage[];
  createdAt: Date;
}

// 서버 API 모델들
export interface WorldGenerationRequest {
  prompt: string;
  setting?: string;
  theme?: string;
  additionalInfo?: string;
  useWebSearch?: boolean;
  includeNPCs?: boolean;
  generationType?: 'simple' | 'complex';
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

// NPC 생산품 관련 인터페이스
export interface NPCProduct {
  id: string;
  npcId: string;
  type: 'weapon' | 'quest' | 'magic' | 'item';
  name: string;
  description: string;
  createdAt: Date;
}

export interface Weapon extends NPCProduct {
  type: 'weapon';
  weaponType: string; // 검, 활, 지팡이 등
  damage: number;
  durability: number;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  glbModelUrl?: string;
  materials: string[];
  enchantments?: string[];
}

export interface Quest extends NPCProduct {
  type: 'quest';
  questType: 'main' | 'side' | 'daily' | 'epic';
  difficulty: 'easy' | 'normal' | 'hard' | 'extreme';
  objectives: QuestObjective[];
  rewards: QuestReward[];
  prerequisites?: string[];
  estimatedTime: number; // 분 단위
}

export interface QuestObjective {
  id: string;
  description: string;
  type: 'kill' | 'collect' | 'deliver' | 'interact' | 'explore';
  target?: string;
  quantity?: number;
  completed: boolean;
}

export interface QuestReward {
  type: 'experience' | 'gold' | 'item' | 'skill';
  amount: number;
  itemName?: string;
}

export interface Magic extends NPCProduct {
  type: 'magic';
  magicType: 'spell' | 'enchantment' | 'ritual' | 'potion';
  school: string; // 마법 학파 (화염, 얼음, 치유 등)
  level: number;
  manaCost: number;
  castingTime: string;
  duration?: string;
  range: string;
  components: string[];
  effects: MagicEffect[];
}

export interface MagicEffect {
  type: 'damage' | 'heal' | 'buff' | 'debuff' | 'utility';
  value: number;
  duration?: number;
  description: string;
}

// 세계관 저장/불러오기 관련 인터페이스
export interface SavedWorldData {
  id: string;
  name: string;
  description?: string;
  world: GameWorld;
  npcs: NPCProfile[];
  history: HistoryEra[];
  createdAt: Date;
  updatedAt: Date;
}

export interface SaveWorldRequest {
  name: string;
  description?: string;
  world: GameWorld;
  npcs: NPCProfile[];
  history: HistoryEra[];
}

export interface SaveWorldResponse {
  success: boolean;
  message: string;
  savedData?: SavedWorldData;
  error?: string;
}

export interface LoadWorldResponse {
  success: boolean;
  message: string;
  worldData?: SavedWorldData;
  error?: string;
}

export interface WorldListResponse {
  success: boolean;
  message: string;
  worlds: SavedWorldData[];
  error?: string;
} 