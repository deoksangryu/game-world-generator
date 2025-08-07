import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { Weapon } from '../models/game-world.interface';

/**
 * 무기 제작 서비스
 * 무기 생성, 관리 및 3D 모델 처리를 담당합니다.
 * 다이얼로그 기능은 제외하고 핵심 무기 기능만 제공합니다.
 */
@Injectable({
  providedIn: 'root'
})
export class WeaponCraftingService {

  constructor() { }

  /**
   * NPC 역할에 따른 무기 생성
   * @param npcId NPC ID
   * @param npcRole NPC 역할
   * @returns 생성된 무기 목록
   */
  generateWeaponsForNPC(npcId: string, npcRole: string): Observable<Weapon[]> {
    const weapons: Weapon[] = [];

    switch (npcRole) {
      case '대장장이':
        weapons.push(...this.createBlacksmithWeapons(npcId));
        break;
      case '기사':
        weapons.push(...this.createKnightWeapons(npcId));
        break;
      case '궁수':
        weapons.push(...this.createArcherWeapons(npcId));
        break;
      case '마법사':
        weapons.push(...this.createMageWeapons(npcId));
        break;
      case '도적':
        weapons.push(...this.createRogueWeapons(npcId));
        break;
      default:
        weapons.push(...this.createCommonWeapons(npcId));
        break;
    }

    return of(weapons);
  }

  /**
   * 대장장이 전용 무기 생성
   */
  private createBlacksmithWeapons(npcId: string): Weapon[] {
    return [
      {
        id: `weapon_${npcId}_1`,
        npcId,
        type: 'weapon',
        name: '용의 검',
        description: '드래곤의 불꽃으로 단련된 강력한 검',
        weaponType: '양손검',
        damage: 85,
        durability: 100,
        rarity: 'epic',
        materials: ['드래곤 스케일', '미스릴', '화염석'],
        enchantments: ['화염 강화', '내구도 증가'],
        createdAt: new Date()
      },
      {
        id: `weapon_${npcId}_2`,
        npcId,
        type: 'weapon',
        name: '거대한 전쟁 망치',
        description: '거대한 적들을 분쇄하는 강력한 망치',
        weaponType: '양손 망치',
        damage: 95,
        durability: 90,
        rarity: 'legendary',
        materials: ['타이탄 골드', '고대 철'],
        enchantments: ['충격파', '갑옷 관통'],
        createdAt: new Date()
      }
    ];
  }

  /**
   * 기사 전용 무기 생성
   */
  private createKnightWeapons(npcId: string): Weapon[] {
    return [
      {
        id: `weapon_${npcId}_1`,
        npcId,
        type: 'weapon',
        name: '성스러운 롱소드',
        description: '빛의 힘이 깃든 성기사의 검',
        weaponType: '롱소드',
        damage: 70,
        durability: 95,
        rarity: 'rare',
        materials: ['성철', '빛의 수정'],
        enchantments: ['성스러운 빛', '악령 특효'],
        createdAt: new Date()
      }
    ];
  }

  /**
   * 궁수 전용 무기 생성
   */
  private createArcherWeapons(npcId: string): Weapon[] {
    return [
      {
        id: `weapon_${npcId}_1`,
        npcId,
        type: 'weapon',
        name: '엘프의 장궁',
        description: '바람의 정령이 깃든 신비로운 활',
        weaponType: '장궁',
        damage: 60,
        durability: 85,
        rarity: 'epic',
        materials: ['세계수 나무', '바람 정수'],
        enchantments: ['바람 가속', '관통력 증가'],
        createdAt: new Date()
      }
    ];
  }

  /**
   * 마법사 전용 무기 생성
   */
  private createMageWeapons(npcId: string): Weapon[] {
    return [
      {
        id: `weapon_${npcId}_1`,
        npcId,
        type: 'weapon',
        name: '고대의 마법 지팡이',
        description: '고대 마법사들이 사용하던 강력한 지팡이',
        weaponType: '마법 지팡이',
        damage: 50,
        durability: 80,
        rarity: 'legendary',
        materials: ['고대 수정', '용의 심장'],
        enchantments: ['마나 증폭', '주문 가속'],
        createdAt: new Date()
      }
    ];
  }

  /**
   * 도적 전용 무기 생성
   */
  private createRogueWeapons(npcId: string): Weapon[] {
    return [
      {
        id: `weapon_${npcId}_1`,
        npcId,
        type: 'weapon',
        name: '그림자 단검',
        description: '어둠 속에서 빛나는 암살자의 단검',
        weaponType: '단검',
        damage: 40,
        durability: 70,
        rarity: 'rare',
        materials: ['그림자 금속', '독 수정'],
        enchantments: ['독 코팅', '은신 강화'],
        createdAt: new Date()
      }
    ];
  }

  /**
   * 일반 무기 생성
   */
  private createCommonWeapons(npcId: string): Weapon[] {
    return [
      {
        id: `weapon_${npcId}_1`,
        npcId,
        type: 'weapon',
        name: '강철 검',
        description: '견고하게 제작된 기본적인 강철 검',
        weaponType: '한손검',
        damage: 35,
        durability: 60,
        rarity: 'common',
        materials: ['강철', '가죽'],
        enchantments: [],
        createdAt: new Date()
      }
    ];
  }

  /**
   * 무기 등급별 색상 반환
   */
  getRarityColor(rarity: string): string {
    const colors = {
      common: '#9ca3af',
      uncommon: '#10b981',
      rare: '#3b82f6',
      epic: '#8b5cf6',
      legendary: '#f59e0b'
    };
    return colors[rarity as keyof typeof colors] || colors.common;
  }

  /**
   * 무기 등급 한글 텍스트 반환
   */
  getRarityText(rarity: string): string {
    const texts = {
      common: '일반',
      uncommon: '고급',
      rare: '희귀',
      epic: '영웅',
      legendary: '전설'
    };
    return texts[rarity as keyof typeof texts] || '일반';
  }

  /**
   * 무기 타입별 아이콘 반환
   */
  getWeaponTypeIcon(weaponType: string): string {
    const icons = {
      '양손검': '⚔️',
      '한손검': '🗡️',
      '롱소드': '⚔️',
      '단검': '🔪',
      '장궁': '🏹',
      '석궁': '🏹',
      '마법 지팡이': '🔮',
      '양손 망치': '🔨',
      '도끼': '🪓',
      '창': '🔱'
    };
    return icons[weaponType as keyof typeof icons] || '⚔️';
  }
} 