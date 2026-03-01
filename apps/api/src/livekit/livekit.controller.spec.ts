/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { LivekitController } from './livekit.controller';
import { LivekitService } from './livekit.service';

describe('LivekitController', () => {
  let app: INestApplication;
  let livekitService: LivekitService;

  const mockTokenResponse = {
    token: 'mock-jwt-token',
    serverUrl: 'wss://test.livekit.cloud',
    roomName: 'test-room',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LivekitController],
      providers: [
        {
          provide: LivekitService,
          useValue: {
            generateToken: jest.fn().mockResolvedValue(mockTokenResponse),
          },
        },
      ],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();

    livekitService = module.get<LivekitService>(LivekitService);
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /livekit/token', () => {
    it('should return 201 with token response for valid body', async () => {
      const response = await request(app.getHttpServer())
        .post('/livekit/token')
        .send({ roomName: 'test', identity: 'user1' })
        .expect(201);

      expect(response.body).toEqual(mockTokenResponse);
      expect(jest.spyOn(livekitService, 'generateToken')).toHaveBeenCalledWith(
        expect.objectContaining({
          roomName: 'test',
          identity: 'user1',
        }),
      );
    });

    it('should return 400 when roomName is missing', async () => {
      const response = await request(app.getHttpServer())
        .post('/livekit/token')
        .send({ identity: 'user1' })
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });

    it('should return 400 when identity is missing', async () => {
      const response = await request(app.getHttpServer())
        .post('/livekit/token')
        .send({ roomName: 'test' })
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });

    it('should return 400 when extra fields are provided', async () => {
      const response = await request(app.getHttpServer())
        .post('/livekit/token')
        .send({
          roomName: 'test',
          identity: 'user1',
          extraField: 'not-allowed',
        })
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });

    it('should return 500 when service throws', async () => {
      jest
        .spyOn(livekitService, 'generateToken')
        .mockRejectedValue(new Error('Service error'));

      await request(app.getHttpServer())
        .post('/livekit/token')
        .send({ roomName: 'test', identity: 'user1' })
        .expect(500);
    });

    it('should pass optional fields to service', async () => {
      await request(app.getHttpServer())
        .post('/livekit/token')
        .send({
          roomName: 'test',
          identity: 'user1',
          participantName: 'John',
        })
        .expect(201);

      expect(jest.spyOn(livekitService, 'generateToken')).toHaveBeenCalledWith(
        expect.objectContaining({
          roomName: 'test',
          identity: 'user1',
          participantName: 'John',
        }),
      );
    });
  });
});
