import { Module } from '@nestjs/common';
import { BarsController } from './bars.controller';
import { BarsService } from './bars.service';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [HttpModule],
  controllers: [BarsController],
  providers: [BarsService],
})
export class BarsModule {}
