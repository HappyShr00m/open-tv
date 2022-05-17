import { AfterViewInit, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { invoke } from '@tauri-apps/api/tauri';
import { debounceTime, distinctUntilChanged, filter, fromEvent, map, Subject, tap } from 'rxjs';
import { Mode } from 'src/app/models/mode';
import { MemoryService } from '../memory.service';
import { Category } from '../models/category';
import { Channel } from '../models/channel';
import { SettingsComponent } from '../settings/settings.component';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements AfterViewInit {

  all: Channel[] = [];
  categories: Category[] = [];
  @ViewChild('search') search!: ElementRef;
  readonly elementsToRetrieve = 36;
  currentMode = Mode.All;
  Mode = Mode;

  constructor(private router: Router, public memory: MemoryService) {
    if (this.memory.Channels.length > 0 || this.memory.retrieveChannels()) {
      this.getChannels();
    }
  }

  ngAfterViewInit(): void {
    fromEvent(this.search.nativeElement, 'keyup').pipe(
      map((event: any) => {
        return event.target.value;
      })
      , debounceTime(300)
      , distinctUntilChanged()
    ).subscribe((term: string) => {
      this.filterChannels(term);
    });
  }

  SwitchToAll(){
    if(this.currentMode == Mode.All)
      return;
    
  }

  getChannels() {
    this.all = this.memory.Channels.slice(0, this.elementsToRetrieve);
    this.categories = [...this.memory.Categories];
  }

  filterChannels(term: string) {
    this.all = this.memory.Channels
      .filter(y => y.name.toLowerCase().indexOf(term.toLowerCase()) > -1)
      .slice(0, this.elementsToRetrieve)
  }

  openSettings() {
    this.router.navigateByUrl("settings");
  }
}
