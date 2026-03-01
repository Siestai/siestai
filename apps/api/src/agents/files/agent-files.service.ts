import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { db, agentFiles, eq, and, desc } from '@siestai/db';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class AgentFilesService {
  private uploadDir: string;

  constructor(private readonly config: ConfigService) {
    this.uploadDir = path.resolve(
      this.config.get('UPLOAD_DIR') || './uploads',
    );
  }

  private async ensureDir(dir: string) {
    await fs.mkdir(dir, { recursive: true });
  }

  async listFiles(agentId: string) {
    return db
      .select()
      .from(agentFiles)
      .where(eq(agentFiles.agentId, agentId))
      .orderBy(desc(agentFiles.createdAt));
  }

  async uploadFile(agentId: string, file: Express.Multer.File) {
    const agentDir = path.join(this.uploadDir, 'agents', agentId);
    await this.ensureDir(agentDir);

    const filePath = path.join(agentDir, file.originalname);
    await fs.writeFile(filePath, file.buffer);

    const rows = await db
      .insert(agentFiles)
      .values({
        agentId,
        filename: file.originalname,
        filePath,
        mimeType: file.mimetype,
        fileSize: file.size,
      })
      .returning();

    return rows[0];
  }

  async deleteFile(agentId: string, fileId: string) {
    const rows = await db
      .delete(agentFiles)
      .where(and(eq(agentFiles.id, fileId), eq(agentFiles.agentId, agentId)))
      .returning();

    if (rows.length === 0) {
      throw new NotFoundException('File not found');
    }

    try {
      await fs.unlink(rows[0].filePath);
    } catch {
      // file already gone from disk
    }

    return { ok: true };
  }

  async getFile(agentId: string, fileId: string) {
    const rows = await db
      .select()
      .from(agentFiles)
      .where(and(eq(agentFiles.id, fileId), eq(agentFiles.agentId, agentId)));

    if (rows.length === 0) {
      throw new NotFoundException('File not found');
    }
    return rows[0];
  }
}
