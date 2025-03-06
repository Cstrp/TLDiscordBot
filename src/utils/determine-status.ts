export const determineStatus = (svgContent: string): string => {
  if (svgContent.includes('24FF00')) return 'Good';
  if (svgContent.includes('FFF500')) return 'Busy';
  if (svgContent.includes('FF0000')) return 'Full';
  if (svgContent.includes('00F0FF')) return 'In-Maintenance';
  return 'Unknown';
};
