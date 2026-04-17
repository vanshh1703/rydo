export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d;
};

function deg2rad(deg) {
  return deg * (Math.PI / 180);
}

export const VEHICLE_TYPES = [
  { id: 'mini', name: 'Rydo Mini', base: 40, perKm: 12, icon: 'Car', description: 'Comfy, small cars' },
  { id: 'sedan', name: 'Rydo Sedan', base: 60, perKm: 15, icon: 'Car', description: 'Spacious sedans' },
  { id: 'xl', name: 'Rydo XL', base: 100, perKm: 22, icon: 'Car', description: 'SUVs for 6+' },
  { id: 'moto', name: 'Rydo Moto', base: 25, perKm: 6, icon: 'Bike', description: 'Fast bike rides' },
  { id: 'scooty', name: 'Rydo Scooty', base: 20, perKm: 5, icon: 'Bike', description: 'Affordable scooty' }
];

export const calculateFareOptions = (distanceKm) => {
  return VEHICLE_TYPES.map(vt => ({
    ...vt,
    totalFare: Math.round(vt.base + distanceKm * vt.perKm)
  }));
};

export const getStatusColor = (status) => {
  switch (status) {
    case 'requested': return 'bg-yellow-100 text-yellow-800';
    case 'accepted': return 'bg-blue-100 text-blue-800';
    case 'arrived': return 'bg-indigo-100 text-indigo-800';
    case 'started': return 'bg-green-100 text-green-800';
    case 'completed': return 'bg-gray-100 text-gray-800';
    case 'cancelled': return 'bg-red-100 text-red-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};
