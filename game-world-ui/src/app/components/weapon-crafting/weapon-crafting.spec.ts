import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WeaponCrafting } from './weapon-crafting';

describe('WeaponCrafting', () => {
  let component: WeaponCrafting;
  let fixture: ComponentFixture<WeaponCrafting>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WeaponCrafting]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WeaponCrafting);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
