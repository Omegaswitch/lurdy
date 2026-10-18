import { shieldSvg } from '@lurdy/shared';
import { SvgXml } from 'react-native-svg';

export function Shield({ width = 72 }: { width?: number }) {
  return <SvgXml xml={shieldSvg} width={width} height={(width * 126.2) / 109.6} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />;
}
