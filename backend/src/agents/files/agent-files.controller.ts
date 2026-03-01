import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { AgentFilesService } from './agent-files.service';
import * as fs from 'fs';

@Controller('agents/:agentId/files')
export class AgentFilesController {
  constructor(private readonly filesService: AgentFilesService) {}

  @Get()
  listFiles(@Param('agentId') agentId: string) {
    return this.filesService.listFiles(agentId);
  }

  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10_000_000 } }))
  uploadFile(
    @Param('agentId') agentId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.filesService.uploadFile(agentId, file);
  }

  @Delete(':fileId')
  deleteFile(
    @Param('agentId') agentId: string,
    @Param('fileId') fileId: string,
  ) {
    return this.filesService.deleteFile(agentId, fileId);
  }

  @Get(':fileId/download')
  async downloadFile(
    @Param('agentId') agentId: string,
    @Param('fileId') fileId: string,
    @Res() res: Response,
  ) {
    const fileRecord = await this.filesService.getFile(agentId, fileId);
    const stream = fs.createReadStream(fileRecord.file_path);
    res.set({
      'Content-Type': fileRecord.mime_type || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${fileRecord.filename}"`,
    });
    stream.pipe(res);
  }
}
