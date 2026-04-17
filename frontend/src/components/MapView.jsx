import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icons in Leaflet
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

// Custom icons for pickup and drop
const pickupIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/684/684908.png',
  iconSize: [35, 35],
  iconAnchor: [17, 34],
});

const dropIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/1673/1673188.png',
  iconSize: [35, 35],
  iconAnchor: [17, 34],
});

const driverIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/3202/3202926.png', // Taxi icon
  iconSize: [40, 40],
  iconAnchor: [20, 20],
  popupAnchor: [0, -20],
  className: 'driver-marker-premium'
});

// Component to handle map clicks
const MapClickHandler = ({ onMapClick }) => {
  useMapEvents({
    click: (e) => {
      onMapClick(e);
    },
  });
  return null;
};

// Component to handle map centering and flying
const MapCenterHandler = ({ position }) => {
  const map = useMap();
  useEffect(() => {
    if (position) {
      // Use current zoom instead of hardcoding, and only fly if coordinates actually changed
      map.flyTo(position, map.getZoom() || 14);
    }
  }, [position[0], position[1], map]); // Use primitive coords to avoid reference issues
  return null;
};

const MapView = ({ pickup, drop, driver, routePositions, onMapClick, mapCenter, centerOnDriver }) => {
  const defaultCenter = [28.6139, 77.2090]; // Delhi

  return (
    <MapContainer 
      center={mapCenter || defaultCenter} 
      zoom={13} 
      className="w-full h-full z-0"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        className="map-tiles-premium"
      />
      
      <MapClickHandler onMapClick={onMapClick} />
      
      {/* Dynamic Centering Logic */}
      {centerOnDriver && driver ? (
        <MapCenterHandler position={driver} />
      ) : pickup ? (
        <MapCenterHandler position={pickup} />
      ) : mapCenter ? (
        <MapCenterHandler position={mapCenter} />
      ) : null}

      {pickup && (
        <Marker position={pickup} icon={pickupIcon}>
          <Popup>Pickup Location</Popup>
        </Marker>
      )}

      {drop && (
        <Marker position={drop} icon={dropIcon}>
          <Popup>Drop Location</Popup>
        </Marker>
      )}
      
      {driver && (
        <Marker position={driver} icon={driverIcon}>
          <Popup>Driver location</Popup>
        </Marker>
      )}

      {/* Show road route if available, otherwise fallback to straight line if both selected */}
      {routePositions && routePositions.length > 0 ? (
        <Polyline positions={routePositions} color="#3b82f6" weight={6} opacity={0.8} />
      ) : pickup && drop ? (
        <Polyline positions={[pickup, drop]} color="black" weight={4} opacity={0.6} dashArray="10, 10" />
      ) : null}
    </MapContainer>
  );
};

export default MapView;
