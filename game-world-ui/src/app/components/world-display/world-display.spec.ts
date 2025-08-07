import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WorldDisplay } from './world-display';

describe('WorldDisplay', () => {
  let component: WorldDisplay;
  let fixture: ComponentFixture<WorldDisplay>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WorldDisplay]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WorldDisplay);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
