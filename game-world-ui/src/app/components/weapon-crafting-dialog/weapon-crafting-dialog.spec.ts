import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WeaponCraftingDialog } from './weapon-crafting-dialog';

describe('WeaponCraftingDialog', () => {
  let component: WeaponCraftingDialog;
  let fixture: ComponentFixture<WeaponCraftingDialog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WeaponCraftingDialog]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WeaponCraftingDialog);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
