import { TestBed } from '@angular/core/testing';

import { GameWorld } from './game-world';

describe('GameWorld', () => {
  let service: GameWorld;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(GameWorld);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
