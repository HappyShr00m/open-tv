import { Channel } from "./channel";

export class Category {
    name!: String;
    logo!: String;
    channels: Channel[] = [];
}