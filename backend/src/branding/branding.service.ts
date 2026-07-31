import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BrandingProfile } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import {
  BrandProfile,
  DEFAULT_BRAND_PROFILE,
  resolveBrandProfile,
} from '../reports/templates/cybersec-format.constants';
import {
  BrandingProfileDto,
  BrandingProfileOptionDto,
  CreateBrandingProfileDto,
  UpdateBrandingProfileDto,
} from './dto/branding-profile.dto';

/** A profile row carrying the number of projects that picked it. */
type BrandingProfileRow = BrandingProfile & {
  _count?: { projects: number };
};

const withProjectCount = {
  _count: { select: { projects: true } },
} as const;

const LOGO_MAX_BYTES = 2 * 1024 * 1024;
const LOGO_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
]);

@Injectable()
export class BrandingService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<BrandingProfileDto[]> {
    const rows = await this.prisma.brandingProfile.findMany({
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
      include: withProjectCount,
    });
    return rows.map((row) => this.toDto(row));
  }

  /** Active profiles for the project create/edit picker. */
  async listOptions(): Promise<BrandingProfileOptionDto[]> {
    const rows = await this.prisma.brandingProfile.findMany({
      where: { isActive: true },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        companyName: true,
        isDefault: true,
      },
    });
    return rows;
  }

  async get(id: string): Promise<BrandingProfileDto> {
    return this.toDto(await this.requireProfile(id));
  }

  async create(
    dto: CreateBrandingProfileDto,
    userId?: string,
  ): Promise<BrandingProfileDto> {
    await this.assertUniqueName(dto.name);
    if (dto.isDefault) {
      await this.clearDefault();
    }
    const created = await this.prisma.brandingProfile.create({
      data: {
        name: dto.name.trim(),
        companyName: dto.companyName.trim(),
        documentOwner: dto.documentOwner.trim(),
        primaryColor: dto.primaryColor ?? DEFAULT_BRAND_PROFILE.primaryColor,
        accentColor: dto.accentColor ?? DEFAULT_BRAND_PROFILE.accentColor,
        mutedColor: dto.mutedColor ?? DEFAULT_BRAND_PROFILE.mutedColor,
        lineColor: dto.lineColor ?? DEFAULT_BRAND_PROFILE.lineColor,
        isDefault: dto.isDefault ?? false,
        isActive: true,
        updatedById: userId ?? null,
      },
    });
    return this.toDto(created);
  }

  async update(
    id: string,
    dto: UpdateBrandingProfileDto,
    userId?: string,
  ): Promise<BrandingProfileDto> {
    await this.requireProfile(id);
    if (dto.name) {
      await this.assertUniqueName(dto.name, id);
    }
    if (dto.isDefault === true) {
      await this.clearDefault(id);
    }
    const updated = await this.prisma.brandingProfile.update({
      where: { id },
      include: withProjectCount,
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.companyName !== undefined
          ? { companyName: dto.companyName.trim() }
          : {}),
        ...(dto.documentOwner !== undefined
          ? { documentOwner: dto.documentOwner.trim() }
          : {}),
        ...(dto.primaryColor !== undefined
          ? { primaryColor: dto.primaryColor }
          : {}),
        ...(dto.accentColor !== undefined
          ? { accentColor: dto.accentColor }
          : {}),
        ...(dto.mutedColor !== undefined
          ? { mutedColor: dto.mutedColor }
          : {}),
        ...(dto.lineColor !== undefined ? { lineColor: dto.lineColor } : {}),
        ...(dto.isDefault !== undefined ? { isDefault: dto.isDefault } : {}),
        updatedById: userId ?? null,
      },
    });
    return this.toDto(updated);
  }

  /**
   * Deleting a brand releases the projects that used it. They fall back to the
   * default profile on their next export rather than blocking the delete.
   */
  async remove(id: string): Promise<void> {
    await this.requireProfile(id);
    await this.prisma.$transaction([
      this.prisma.project.updateMany({
        where: { brandingProfileId: id },
        data: { brandingProfileId: null },
      }),
      this.prisma.brandingProfile.delete({ where: { id } }),
    ]);
  }

  async uploadLogo(
    id: string,
    file: Express.Multer.File | undefined,
    userId?: string,
  ): Promise<BrandingProfileDto> {
    await this.requireProfile(id);
    if (!file) {
      throw new BadRequestException('Select a logo image to upload');
    }
    if (!LOGO_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException(
        'Logo must be a PNG, JPEG, GIF or WebP image',
      );
    }
    if (file.size > LOGO_MAX_BYTES) {
      throw new BadRequestException('Logo must be 2 MB or smaller');
    }
    const updated = await this.prisma.brandingProfile.update({
      where: { id },
      include: withProjectCount,
      data: {
        logoData: file.buffer,
        logoMimeType: file.mimetype,
        logoFileName: file.originalname,
        updatedById: userId ?? null,
      },
    });
    return this.toDto(updated);
  }

  async clearLogo(id: string, userId?: string): Promise<BrandingProfileDto> {
    await this.requireProfile(id);
    const updated = await this.prisma.brandingProfile.update({
      where: { id },
      include: withProjectCount,
      data: {
        logoData: null,
        logoMimeType: null,
        logoFileName: null,
        updatedById: userId ?? null,
      },
    });
    return this.toDto(updated);
  }

  /**
   * Resolve the brand a project should render under: the project's pick,
   * otherwise the default profile, otherwise the env/default constants.
   */
  async resolveForProject(projectId: string): Promise<BrandProfile> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        brandingProfile: true,
      },
    });
    if (project?.brandingProfile?.isActive) {
      return this.toBrandProfile(project.brandingProfile);
    }
    const fallback = await this.prisma.brandingProfile.findFirst({
      where: { isDefault: true, isActive: true },
    });
    if (fallback) {
      return this.toBrandProfile(fallback);
    }
    return resolveBrandProfile();
  }

  toBrandProfile(row: BrandingProfile): BrandProfile {
    return resolveBrandProfile({
      companyName: row.companyName,
      documentOwner: row.documentOwner,
      logoPath: null,
      logoData: row.logoData ? Buffer.from(row.logoData) : null,
      logoMimeType: row.logoMimeType,
      primaryColor: row.primaryColor,
      accentColor: row.accentColor,
      mutedColor: row.mutedColor,
      lineColor: row.lineColor,
    });
  }

  private async requireProfile(id: string): Promise<BrandingProfileRow> {
    const row = await this.prisma.brandingProfile.findUnique({
      where: { id },
      include: withProjectCount,
    });
    if (!row) throw new NotFoundException('Branding profile not found');
    return row;
  }

  private async assertUniqueName(name: string, excludeId?: string) {
    const existing = await this.prisma.brandingProfile.findFirst({
      where: {
        name: { equals: name.trim(), mode: 'insensitive' },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
    if (existing) {
      throw new ConflictException(
        `A branding profile named "${name.trim()}" already exists`,
      );
    }
  }

  private async clearDefault(exceptId?: string) {
    await this.prisma.brandingProfile.updateMany({
      where: {
        isDefault: true,
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
      data: { isDefault: false },
    });
  }

  private toDto(row: BrandingProfileRow): BrandingProfileDto {
    return {
      projectCount: row._count?.projects ?? 0,
      id: row.id,
      name: row.name,
      companyName: row.companyName,
      documentOwner: row.documentOwner,
      logoFileName: row.logoFileName,
      logoMimeType: row.logoMimeType,
      hasLogo: Boolean(row.logoData && row.logoData.length > 0),
      primaryColor: row.primaryColor,
      accentColor: row.accentColor,
      mutedColor: row.mutedColor,
      lineColor: row.lineColor,
      isDefault: row.isDefault,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
