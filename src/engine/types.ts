export type Posture = 'A' | 'B' | 'C';
export type CardType = 'attack' | 'defense' | 'dodge';
export type Priority = 0 | 1; // 0 = P1, 1 = P2

export interface TcgCard {
  id: string;
  type: CardType;
  requires?: Posture;
  target?: Posture;
  final?: Posture;
}

export interface PlayerState {
  name: string;
  posture: Posture;
  breath: number;
  hand: TcgCard[];
  revealed?: TcgCard | null;
}

export interface CpuPlayerState extends PlayerState {
  isCPU: boolean;
}

export type ImpactKind =
  | 'none'
  | 'p1_hits'
  | 'p2_hits'
  | 'blocked_p2'
  | 'blocked_p1'
  | 'dodged_p2'
  | 'dodged_p1'
  | 'miss_p1'
  | 'miss_p2'
  | 'extra_p1'
  | 'extra_p2'
  | 'extra_granted_p1'
  | 'extra_granted_p2'
  | 'steal_p1'
  | 'steal_p2'
  | 'spend_p1'
  | 'spend_p2'
  | 'gain_p1'
  | 'gain_p2'
  | 'defeat_p1'
  | 'defeat_p2';

export type DefeatTag = 'p1' | 'p2' | 'both' | null;

export interface ResolveResult {
  p1: PlayerState;
  p2: PlayerState;
  events: ImpactKind[];
  log: string[];
  nextPriorityOwner: Priority;
  defeated: DefeatTag;
  consumedCards: { p1: TcgCard[]; p2: TcgCard[] };
}
