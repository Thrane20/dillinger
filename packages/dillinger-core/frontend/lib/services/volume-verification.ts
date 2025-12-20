import Docker from 'dockerode';
// existsSync may be used for future local path checks
// import { existsSync } from 'fs';

const docker = new Docker({ socketPath: '/var/run/docker.sock' });

export class VolumeVerificationService {
  private static readonly REQUIRED_VOLUME = 'dillinger_root';

  /**
   * Verify that the required dillinger_root volume exists and is accessible
   * This is the foundational volume that all Dillinger JSON data sits on
   */
  static async verifyRequiredVolumes(): Promise<void> {
    console.log('🔍 Verifying required Docker volumes...');
    
    try {
      // Check if dillinger_root volume exists
      const volume = docker.getVolume(this.REQUIRED_VOLUME);
      const volumeInfo = await volume.inspect();
      
      console.log(`✅ Found ${this.REQUIRED_VOLUME} volume`);
      console.log(`   📍 Mountpoint: ${volumeInfo.Mountpoint}`);
      console.log(`   🏷️  Driver: ${volumeInfo.Driver}`);
      
      // If it's a bind mount, verify the host path exists
      if (volumeInfo.Options?.device) {
        const hostPath = volumeInfo.Options.device;
        console.log(`   🔗 Bind mount target: ${hostPath}`);
        
        // Note: We cannot verify host path existence from within the container
        // unless we have the host filesystem mounted.
        // In production, we assume the volume mount is correct.
        console.log(`   ℹ️  Skipping host path verification (running in container)`);
      }
      
    } catch (error: any) {
      if (error.statusCode === 404) {
        // Volume doesn't exist - this is the main error case
        console.error(`❌ Required volume "${this.REQUIRED_VOLUME}" not found`);
        console.error('');
        console.error('💡 To fix this issue:');
        console.error('');
        console.error('   1. Create the dillinger_root volume:');
        console.error('      docker volume create dillinger_root');
        console.error('');
        console.error('   2. Or create as a bind mount to a host directory:');
        console.error('      docker volume create \\');
        console.error('        --driver local \\');
        console.error('        --opt type=none \\');
        console.error('        --opt device=/path/to/your/dillinger/data \\');
        console.error('        --opt o=bind \\');
        console.error('        dillinger_root');
        console.error('');
        console.error('   3. For development, you can use:');
        console.error('      docker volume create \\');
        console.error('        --driver local \\');
        console.error('        --opt type=none \\');
        console.error('        --opt device=$(pwd)/packages/dillinger-core/backend/data \\');
        console.error('        --opt o=bind \\');
        console.error('        dillinger_root');
        console.error('');
        
        throw new Error(`You must have a volume mounted "dillinger_root" for the dillinger core to run`);
      }
      
      // Re-throw other Docker errors (connection issues, etc.)
      throw new Error(`Failed to verify dillinger_root volume: ${error.message}`);
    }
  }

  /**
   * Get the mount point of the dillinger_root volume
   * This can be used to ensure DILLINGER_ROOT environment variable points to the right place
   */
  static async getDillingerRootPath(): Promise<string> {
    try {
      const volume = docker.getVolume(this.REQUIRED_VOLUME);
      const volumeInfo = await volume.inspect();
      
      // For bind mounts, return the host device path
      if (volumeInfo.Options?.device) {
        return volumeInfo.Options.device;
      }
      
      // For regular Docker volumes, return the mountpoint
      return volumeInfo.Mountpoint;
      
    } catch (error) {
      throw new Error(`Cannot determine dillinger_root path: ${error}`);
    }
  }

  /**
   * Create the dillinger_root volume if it doesn't exist (development helper)
   * This is used in development mode to auto-create the volume
   */
  static async createDillingerRootVolume(hostPath?: string): Promise<void> {
    console.log(`🏗️  Creating ${this.REQUIRED_VOLUME} volume...`);
    
    try {
      if (hostPath) {
        // Create as bind mount
        await docker.createVolume({
          Name: this.REQUIRED_VOLUME,
          Driver: 'local',
          DriverOpts: {
            type: 'none',
            device: hostPath,
            o: 'bind'
          }
        });
        console.log(`✅ Created ${this.REQUIRED_VOLUME} volume as bind mount to ${hostPath}`);
      } else {
        // Create as regular Docker volume
        await docker.createVolume({
          Name: this.REQUIRED_VOLUME
        });
        console.log(`✅ Created ${this.REQUIRED_VOLUME} volume`);
      }
    } catch (error: any) {
      if (error.statusCode === 409) {
        console.log(`ℹ️  ${this.REQUIRED_VOLUME} volume already exists`);
        return;
      }
      throw new Error(`Failed to create ${this.REQUIRED_VOLUME} volume: ${error.message}`);
    }
  }
}