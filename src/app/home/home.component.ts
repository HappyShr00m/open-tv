import { AfterViewInit, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { invoke } from '@tauri-apps/api/tauri';
import { debounceTime, distinctUntilChanged, filter, fromEvent, map, Subject, tap } from 'rxjs';
import { MemoryService } from '../memory.service';
import { Channel } from '../models/channel';
import { SettingsComponent } from '../settings/settings.component';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements AfterViewInit  {

  channels: Channel[] = [];
  @ViewChild('search') search!: ElementRef;
  @ViewChild('container') container!: ElementRef;
  readonly elementsToRetrieve = 36;

  constructor(private router: Router, public memory: MemoryService) {
    if (this.memory.Channels.length > 0){
      this.getChannels();
    }
    else {
      invoke("get_cache").then(x => {
        if (x) {
          this.memory.Channels = x as Channel[];
          this.getChannels();
        }
        if (memory.Channels?.length == 0)
          router.navigateByUrl("setup");
      });
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
    //setNumberOfChannels();
  }

  setNumberOfChannels(height: number, width: number){
    let rem = parseInt(getComputedStyle(document.documentElement).fontSize);
    let rows = height / rem / 10;
    let cols = 2;
  }

  getChannels(){
    this.channels = this.memory.Channels.slice(0, this.elementsToRetrieve);
  }

  filterChannels(term: string){
    this.channels = this.memory.Channels
      .filter(y => y.name.toLowerCase().indexOf(term.toLowerCase()) > -1)
      .slice(0, this.elementsToRetrieve)
  }

  openSettings(){
    this.router.navigateByUrl("settings");
  }
}
