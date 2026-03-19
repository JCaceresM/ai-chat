import { Injectable } from '@nestjs/common';

@Injectable()
export class DateProvider {
  now(): number {
    return Date.now();
  }
}
