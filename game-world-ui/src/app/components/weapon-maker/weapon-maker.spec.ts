import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WeaponMaker } from './weapon-maker';

describe('WeaponMaker', () => {
  let component: WeaponMaker;
  let fixture: ComponentFixture<WeaponMaker>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WeaponMaker]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WeaponMaker);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
