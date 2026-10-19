'use dom';
// The Lourdes map: Leaflet with OpenStreetMap street tiles (no satellite), drawn as an Expo DOM component —
// a web view on iOS/Android, plain DOM on the web. Data comes in as props; taps go out through onSelect.
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef } from 'react';
import type { DOMProps } from 'expo/dom';

export type MapPlace = { id: string; name: string; lat: number; lng: number; home?: boolean };
type Props = {
  places: MapPlace[];
  me: { lat: number; lng: number; accuracy: number } | null;
  selectedId: string | null;
  followMe: number; // bump to centre on the current position
  tileUrl: string;
  onSelect: (id: string) => Promise<void>;
  dom?: DOMProps;
};

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const CENTER: [number, number] = [43.0976, -0.0560]; // the sanctuary

export default function LourdesMap({ places, me, selectedId, followMe, tileUrl, onSelect }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const pins = useRef<L.LayerGroup | null>(null);
  const meLayer = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, { zoomControl: true, attributionControl: true }).setView(CENTER, 16);
    L.tileLayer(tileUrl, { maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(m);
    pins.current = L.layerGroup().addTo(m);
    meLayer.current = L.layerGroup().addTo(m);
    map.current = m;
    return () => { m.remove(); map.current = null; };
  }, [tileUrl]);

  useEffect(() => {
    const layer = pins.current;
    if (!layer) return;
    layer.clearLayers();
    for (const p of places) {
      const selected = p.id === selectedId;
      const icon = L.divIcon({
        className: '',
        html: `<div class="pin${selected ? ' sel' : ''}${p.home ? ' home' : ''}"><i></i><span>${esc(p.name)}</span></div>`,
        iconSize: [0, 0],
      });
      L.marker([p.lat, p.lng], { icon, keyboard: true, title: p.name, zIndexOffset: selected ? 1000 : 0 })
        .on('click', () => { onSelect(p.id); })
        .addTo(layer);
    }
  }, [places, selectedId, onSelect]);

  useEffect(() => {
    const p = places.find((x) => x.id === selectedId);
    if (p && map.current) map.current.flyTo([p.lat, p.lng], Math.max(map.current.getZoom(), 17), { duration: 0.6 });
  }, [selectedId, places]);

  useEffect(() => {
    const layer = meLayer.current;
    if (!layer) return;
    layer.clearLayers();
    if (!me) return;
    L.circle([me.lat, me.lng], { radius: me.accuracy, color: '#1f5fa8', weight: 1, fillOpacity: 0.12 }).addTo(layer);
    L.circleMarker([me.lat, me.lng], { radius: 9, color: '#fff', weight: 3, fillColor: '#1f5fa8', fillOpacity: 1 }).addTo(layer);
  }, [me]);

  useEffect(() => {
    if (followMe && me && map.current) map.current.flyTo([me.lat, me.lng], 17, { duration: 0.6 });
  }, [followMe]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <style>{`
        html, body, #root { margin: 0; height: 100%; }
        .leaflet-container { font-family: Asap, "Segoe UI", Arial, sans-serif; background: #f3f3f3; }
        .pin { position: relative; transform: translate(-9px, -9px); display: flex; align-items: center; gap: 4px; white-space: nowrap; }
        .pin i { width: 18px; height: 18px; border-radius: 50%; background: #e31818; border: 3px solid #fff; box-shadow: 0 1px 4px rgba(0,0,0,.4); flex: none; }
        .pin.home i { background: #1d6b35; }
        .pin span { font-size: 14px; font-weight: 600; color: #111; background: rgba(255,255,255,.92); padding: 1px 6px; border-radius: 4px; box-shadow: 0 1px 2px rgba(0,0,0,.2); }
        .pin.sel i { width: 26px; height: 26px; transform: translate(-4px, 0); }
        .pin.sel span { font-size: 17px; background: #111; color: #fff; }
      `}</style>
      <div ref={el} style={{ width: '100%', height: '100%', minHeight: 320 }} role="application" aria-label="Mapa Lurd" />
    </>
  );
}
