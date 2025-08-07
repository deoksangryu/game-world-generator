import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WorldInput } from './world-input';

describe('WorldInput', () => {
  let component: WorldInput;
  let fixture: ComponentFixture<WorldInput>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WorldInput]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WorldInput);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
