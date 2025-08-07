import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NpcProfiles } from './npc-profiles';

describe('NpcProfiles', () => {
  let component: NpcProfiles;
  let fixture: ComponentFixture<NpcProfiles>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NpcProfiles]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NpcProfiles);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
