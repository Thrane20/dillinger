import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs-extra';
import * as path from 'path';
import { JSONStorageService } from '@/lib/services/storage';

const storage = JSONStorageService.getInstance();

// GET /api/platforms/[platformId]/bios - List uploaded BIOS files
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ platformId: string }> }
) {
  try {
    const { platformId } = await params;
    const dillingerRoot = storage.getDillingerRoot();
    
    let biosPath = path.join(dillingerRoot, 'bios');
    if (platformId === 'amiga') {
      biosPath = path.join(biosPath, 'amiga');
    } else {
      biosPath = path.join(biosPath, platformId);
    }
    
    if (!(await fs.pathExists(biosPath))) {
      return NextResponse.json({ files: [] });
    }
    
    const files = await fs.readdir(biosPath);
    const fileDetails = await Promise.all(files.map(async (file) => {
      const filePath = path.join(biosPath, file);
      const stats = await fs.stat(filePath);
      return {
        name: file,
        size: stats.size,
        modified: stats.mtime
      };
    }));
    
    return NextResponse.json({ files: fileDetails });
  } catch (error) {
    console.error('Error listing BIOS files:', error);
    return NextResponse.json(
      { error: 'list_failed', message: error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST /api/platforms/[platformId]/bios - Upload BIOS files
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ platformId: string }> }
) {
  try {
    const { platformId } = await params;
    const dillingerRoot = storage.getDillingerRoot();
    
    let destPath = path.join(dillingerRoot, 'bios');
    if (platformId === 'amiga') {
      destPath = path.join(destPath, 'amiga');
    } else {
      destPath = path.join(destPath, platformId);
    }
    
    await fs.ensureDir(destPath);

    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    
    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No files uploaded' },
        { status: 400 }
      );
    }

    const uploadedFiles = [];
    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const filePath = path.join(destPath, file.name);
      await fs.writeFile(filePath, buffer);
      uploadedFiles.push({
        filename: file.name,
        size: buffer.length,
        path: filePath
      });
    }
    
    return NextResponse.json({
      success: true,
      message: `Uploaded ${uploadedFiles.length} files`,
      files: uploadedFiles
    });
  } catch (error) {
    console.error('Error uploading BIOS files:', error);
    return NextResponse.json(
      { error: 'upload_failed', message: error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : 'Unknown error' },
      { status: 500 }
    );
  }
}
