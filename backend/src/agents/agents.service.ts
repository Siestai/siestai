import { Injectable, NotFoundException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { CreateAgentDto } from './dto/create-agent.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';

@Injectable()
export class AgentsService {
  constructor(private readonly http: HttpService) {}

  async listAgents(params?: { category?: string; search?: string }) {
    const { data } = await firstValueFrom(
      this.http.get('/custom/agents', { params }),
    );
    return data;
  }

  async getAgent(id: string) {
    try {
      const { data } = await firstValueFrom(
        this.http.get(`/custom/agents/${id}`),
      );
      return data;
    } catch (err: any) {
      if (err?.response?.status === 404) {
        throw new NotFoundException('Agent not found');
      }
      throw err;
    }
  }

  async createAgent(dto: CreateAgentDto) {
    const { data } = await firstValueFrom(
      this.http.post('/custom/agents', dto),
    );
    return data;
  }

  async updateAgent(id: string, dto: UpdateAgentDto) {
    try {
      const { data } = await firstValueFrom(
        this.http.put(`/custom/agents/${id}`, dto),
      );
      return data;
    } catch (err: any) {
      if (err?.response?.status === 404) {
        throw new NotFoundException('Agent not found');
      }
      throw err;
    }
  }

  async deleteAgent(id: string) {
    try {
      const { data } = await firstValueFrom(
        this.http.delete(`/custom/agents/${id}`),
      );
      return data;
    } catch (err: any) {
      if (err?.response?.status === 404) {
        throw new NotFoundException('Agent not found');
      }
      throw err;
    }
  }

  async streamAgent(
    id: string,
    messages: { role: string; content: string }[],
  ) {
    const response = await firstValueFrom(
      this.http.post(`/custom/agents/${id}/stream`, { messages }, {
        responseType: 'stream',
      }),
    );
    return response.data;
  }
}
