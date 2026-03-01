import {
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class AgentFilesService implements OnModuleInit {
  private pool: Pool;
  private uploadDir: string;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    this.pool = new Pool({
      connectionString: this.config.get('DATABASE_URL'),
    });
    this.uploadDir = path.resolve(
      this.config.get('UPLOAD_DIR') || './uploads',
    );
  }

  private async ensureDir(dir: string) {
    await fs.mkdir(dir, { recursive: true });
  }

  async listFiles(agentId: string) {
    const { rows } = await this.pool.query(
      'SELECT * FROM agent_files WHERE agent_id = $1 ORDER BY created_at DESC',
      [agentId],
    );
    return rows;
  }

  async uploadFile(
    agentId: string,
    file: Express.Multer.File,
  ) {
    const agentDir = path.join(this.uploadDir, 'agents', agentId);
    await this.ensureDir(agentDir);

    const filePath = path.join(agentDir, file.originalname);
    await fs.writeFile(filePath, file.buffer);

    const { rows } = await this.pool.query(
      `INSERT INTO agent_files (agent_id, filename, file_path, mime_type, file_size)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        agentId,
        file.originalname,
        filePath,
        file.mimetype,
        file.size,
      ],
    );
    return rows[0];
  }

  async deleteFile(agentId: string, fileId: string) {
    const { rows } = await this.pool.query(
      'DELETE FROM agent_files WHERE id = $1 AND agent_id = $2 RETURNING *',
      [fileId, agentId],
    );
    if (rows.length === 0) {
      throw new NotFoundException('File not found');
    }

    try {
      await fs.unlink(rows[0].file_path);
    } catch {
      // file already gone from disk
    }

    return { ok: true };
  }

  async getFile(agentId: string, fileId: string) {
    const { rows } = await this.pool.query(
      'SELECT * FROM agent_files WHERE id = $1 AND agent_id = $2',
      [fileId, agentId],
    );
    if (rows.length === 0) {
      throw new NotFoundException('File not found');
    }
    return rows[0];
  }
}
