import fs from 'fs-extra';

export interface JoystickDevice {
  id: string; // e.g., "js0"
  name: string; // e.g., "Logitech Gamepad F310"
  path: string; // e.g., "/dev/input/js0"
  jsIndex: number; // e.g., 0
}

export async function getAvailableJoysticks(): Promise<JoystickDevice[]> {
  try {
    if (!await fs.pathExists('/proc/bus/input/devices')) {
      console.warn('/proc/bus/input/devices not found. Are you on Linux?');
      return [];
    }

    const content = await fs.readFile('/proc/bus/input/devices', 'utf-8');
    const devices: JoystickDevice[] = [];
    const blocks = content.split('\n\n');

    for (const block of blocks) {
      // Only include devices that have a js (joystick) handler - these are actual game controllers
      if (block.includes('Handlers=') && /\bjs\d+\b/.test(block)) {
        const nameMatch = block.match(/Name="([^"]+)"/);
        const handlersMatch = block.match(/Handlers=(.*)/);
        
        if (nameMatch && nameMatch[1] && handlersMatch && handlersMatch[1]) {
          const name = nameMatch[1];
          const handlers = handlersMatch[1].split(' ');
          const jsHandler = handlers.find(h => /^js\d+$/.test(h));
          
          if (jsHandler) {
            const jsIndex = parseInt(jsHandler.replace('js', ''), 10);
            devices.push({
              id: jsHandler,
              name: name,
              path: `/dev/input/${jsHandler}`,
              jsIndex: jsIndex
            });
          }
        }
      }
    }
    
    // Sort by js index for consistent ordering
    devices.sort((a, b) => a.jsIndex - b.jsIndex);
    
    return devices;
  } catch (error) {
    console.error('Error reading input devices:', error);
    return [];
  }
}
