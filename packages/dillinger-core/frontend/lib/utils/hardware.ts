import fs from 'fs-extra';

export interface JoystickDevice {
  id: string; // e.g., "event11"
  name: string; // e.g., "Logitech Gamepad F310"
  path: string; // e.g., "/dev/input/event11"
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
      if (block.includes('Handlers=') && block.includes('event')) {
        const nameMatch = block.match(/Name="([^"]+)"/);
        const handlersMatch = block.match(/Handlers=(.*)/);
        
        if (nameMatch && nameMatch[1] && handlersMatch && handlersMatch[1]) {
          const name = nameMatch[1];
          const handlers = handlersMatch[1].split(' ');
          const eventHandler = handlers.find(h => h.startsWith('event'));
          
          if (eventHandler) {
             devices.push({
               id: eventHandler,
               name: name,
               path: `/dev/input/${eventHandler}`
             });
          }
        }
      }
    }
    return devices;
  } catch (error) {
    console.error('Error reading input devices:', error);
    return [];
  }
}
