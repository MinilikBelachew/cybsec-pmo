import { BrandingService } from './branding.service';

describe('BrandingService helpers', () => {
  const service = new BrandingService({} as never);

  it('maps a stored profile onto the render BrandProfile', () => {
    const brand = service.toBrandProfile({
      id: '11111111-1111-1111-1111-111111111111',
      name: 'Partner Co',
      companyName: 'Partner Co',
      documentOwner: 'Partner PMO',
      logoData: Buffer.from('png-bytes'),
      logoMimeType: 'image/png',
      logoFileName: 'logo.png',
      primaryColor: '#112233',
      accentColor: '#445566',
      mutedColor: '#778899',
      lineColor: '#AABBCC',
      isDefault: true,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      updatedById: null,
    });

    expect(brand.companyName).toBe('Partner Co');
    expect(brand.documentOwner).toBe('Partner PMO');
    expect(brand.primaryColor).toBe('#112233');
    expect(brand.logoData?.equals(Buffer.from('png-bytes'))).toBe(true);
    expect(brand.logoMimeType).toBe('image/png');
  });
});

describe('BrandingService.remove', () => {
  it('releases the projects that used the brand instead of blocking', async () => {
    const id = '22222222-2222-2222-2222-222222222222';
    const updateMany = jest.fn().mockReturnValue('release-projects');
    const deleteProfile = jest.fn().mockReturnValue('delete-profile');
    const transaction = jest.fn().mockResolvedValue([]);
    const prisma = {
      brandingProfile: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id, name: 'Partner Co', _count: { projects: 2 } }),
        delete: deleteProfile,
      },
      project: { updateMany },
      $transaction: transaction,
    };

    await new BrandingService(prisma as never).remove(id);

    expect(updateMany).toHaveBeenCalledWith({
      where: { brandingProfileId: id },
      data: { brandingProfileId: null },
    });
    expect(deleteProfile).toHaveBeenCalledWith({ where: { id } });
    expect(transaction).toHaveBeenCalledWith([
      'release-projects',
      'delete-profile',
    ]);
  });
});
