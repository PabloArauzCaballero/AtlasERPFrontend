/**
 * Países y ciudades para el selector en árbol de los formularios.
 *
 * La bandera NO se guarda: se deriva del código ISO 3166-1 alfa-2 con los «indicadores regionales»
 * de Unicode (🇧🇴 = B + O), así cualquier país nuevo trae su bandera sin dibujar nada. El backend
 * sólo exige dos letras en `countryCode` y texto libre en `city`, así que la ciudad viaja tal cual.
 *
 * Orden: Bolivia primero (es la plaza principal), después el resto de Latinoamérica, luego
 * Norteamérica, Europa y el resto del mundo. Las ciudades son las capitales y las plazas
 * comerciales más grandes de cada país; para lo que no esté aquí está «Otra ciudad».
 */

export interface GeoCountry {
  /** ISO 3166-1 alfa-2. */
  code: string;
  name: string;
  cities: string[];
}

/** Convierte «BO» en 🇧🇴. Cualquier cosa que no sean dos letras devuelve una cadena vacía. */
export function flagEmoji(countryCode: string): string {
  const code = countryCode.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return '';
  return String.fromCodePoint(...[...code].map((letter) => 0x1f1e6 + letter.charCodeAt(0) - 65));
}

export const geoCountries: GeoCountry[] = [
  { code: 'BO', name: 'Bolivia', cities: ['Santa Cruz de la Sierra', 'La Paz', 'El Alto', 'Cochabamba', 'Sucre', 'Oruro', 'Potosí', 'Tarija', 'Trinidad', 'Cobija', 'Montero', 'Quillacollo', 'Sacaba', 'Riberalta', 'Yacuiba', 'Warnes', 'La Guardia', 'Villa Montes', 'Camiri', 'Bermejo'] },
  // ---- Sudamérica ----
  { code: 'AR', name: 'Argentina', cities: ['Buenos Aires', 'Córdoba', 'Rosario', 'Mendoza', 'La Plata', 'San Miguel de Tucumán', 'Mar del Plata', 'Salta', 'Santa Fe', 'San Juan', 'Neuquén', 'Corrientes', 'Posadas', 'San Salvador de Jujuy', 'Bahía Blanca'] },
  { code: 'BR', name: 'Brasil', cities: ['São Paulo', 'Río de Janeiro', 'Brasilia', 'Salvador', 'Fortaleza', 'Belo Horizonte', 'Manaos', 'Curitiba', 'Recife', 'Porto Alegre', 'Belém', 'Goiânia', 'Campinas', 'Campo Grande', 'Cuiabá', 'Corumbá'] },
  { code: 'CL', name: 'Chile', cities: ['Santiago', 'Valparaíso', 'Viña del Mar', 'Concepción', 'Antofagasta', 'Iquique', 'Arica', 'La Serena', 'Temuco', 'Rancagua', 'Talca', 'Puerto Montt', 'Calama'] },
  { code: 'CO', name: 'Colombia', cities: ['Bogotá', 'Medellín', 'Cali', 'Barranquilla', 'Cartagena', 'Bucaramanga', 'Cúcuta', 'Pereira', 'Santa Marta', 'Ibagué', 'Manizales', 'Villavicencio'] },
  { code: 'EC', name: 'Ecuador', cities: ['Quito', 'Guayaquil', 'Cuenca', 'Santo Domingo', 'Machala', 'Manta', 'Portoviejo', 'Ambato', 'Loja', 'Riobamba'] },
  { code: 'PE', name: 'Perú', cities: ['Lima', 'Arequipa', 'Trujillo', 'Chiclayo', 'Piura', 'Cusco', 'Iquitos', 'Huancayo', 'Tacna', 'Puno', 'Juliaca', 'Callao'] },
  { code: 'PY', name: 'Paraguay', cities: ['Asunción', 'Ciudad del Este', 'San Lorenzo', 'Luque', 'Capiatá', 'Lambaré', 'Encarnación', 'Pedro Juan Caballero'] },
  { code: 'UY', name: 'Uruguay', cities: ['Montevideo', 'Salto', 'Ciudad de la Costa', 'Paysandú', 'Las Piedras', 'Rivera', 'Maldonado', 'Punta del Este'] },
  { code: 'VE', name: 'Venezuela', cities: ['Caracas', 'Maracaibo', 'Valencia', 'Barquisimeto', 'Maracay', 'Ciudad Guayana', 'Barcelona', 'Maturín'] },
  { code: 'GY', name: 'Guyana', cities: ['Georgetown', 'Linden', 'New Amsterdam'] },
  { code: 'SR', name: 'Surinam', cities: ['Paramaribo', 'Lelydorp', 'Nieuw Nickerie'] },
  // ---- Centroamérica y Caribe ----
  { code: 'MX', name: 'México', cities: ['Ciudad de México', 'Guadalajara', 'Monterrey', 'Puebla', 'Tijuana', 'León', 'Ciudad Juárez', 'Querétaro', 'Mérida', 'Cancún', 'Toluca', 'San Luis Potosí', 'Chihuahua', 'Aguascalientes'] },
  { code: 'GT', name: 'Guatemala', cities: ['Ciudad de Guatemala', 'Mixco', 'Villa Nueva', 'Quetzaltenango', 'Escuintla'] },
  { code: 'HN', name: 'Honduras', cities: ['Tegucigalpa', 'San Pedro Sula', 'La Ceiba', 'Choloma', 'El Progreso'] },
  { code: 'SV', name: 'El Salvador', cities: ['San Salvador', 'Santa Ana', 'San Miguel', 'Soyapango', 'Santa Tecla'] },
  { code: 'NI', name: 'Nicaragua', cities: ['Managua', 'León', 'Masaya', 'Chinandega', 'Granada'] },
  { code: 'CR', name: 'Costa Rica', cities: ['San José', 'Alajuela', 'Cartago', 'Heredia', 'Liberia', 'Puntarenas', 'Limón'] },
  { code: 'PA', name: 'Panamá', cities: ['Ciudad de Panamá', 'San Miguelito', 'Colón', 'David', 'La Chorrera'] },
  { code: 'CU', name: 'Cuba', cities: ['La Habana', 'Santiago de Cuba', 'Camagüey', 'Holguín', 'Santa Clara'] },
  { code: 'DO', name: 'República Dominicana', cities: ['Santo Domingo', 'Santiago de los Caballeros', 'La Romana', 'San Pedro de Macorís', 'Punta Cana'] },
  { code: 'PR', name: 'Puerto Rico', cities: ['San Juan', 'Bayamón', 'Carolina', 'Ponce', 'Caguas'] },
  { code: 'JM', name: 'Jamaica', cities: ['Kingston', 'Montego Bay', 'Spanish Town'] },
  { code: 'HT', name: 'Haití', cities: ['Puerto Príncipe', 'Cabo Haitiano', 'Gonaïves'] },
  // ---- Norteamérica ----
  { code: 'US', name: 'Estados Unidos', cities: ['Nueva York', 'Los Ángeles', 'Chicago', 'Houston', 'Miami', 'Dallas', 'San Francisco', 'Washington D. C.', 'Boston', 'Atlanta', 'Seattle', 'Denver', 'Phoenix', 'Las Vegas', 'Orlando'] },
  { code: 'CA', name: 'Canadá', cities: ['Toronto', 'Montreal', 'Vancouver', 'Calgary', 'Ottawa', 'Edmonton', 'Quebec'] },
  // ---- Europa ----
  { code: 'ES', name: 'España', cities: ['Madrid', 'Barcelona', 'Valencia', 'Sevilla', 'Zaragoza', 'Málaga', 'Bilbao', 'Murcia', 'Palma', 'Las Palmas de Gran Canaria', 'Alicante', 'Valladolid'] },
  { code: 'PT', name: 'Portugal', cities: ['Lisboa', 'Oporto', 'Braga', 'Coímbra', 'Faro', 'Funchal'] },
  { code: 'FR', name: 'Francia', cities: ['París', 'Marsella', 'Lyon', 'Toulouse', 'Niza', 'Burdeos', 'Lille', 'Estrasburgo'] },
  { code: 'IT', name: 'Italia', cities: ['Roma', 'Milán', 'Nápoles', 'Turín', 'Florencia', 'Bolonia', 'Venecia', 'Génova'] },
  { code: 'DE', name: 'Alemania', cities: ['Berlín', 'Múnich', 'Hamburgo', 'Fráncfort', 'Colonia', 'Stuttgart', 'Düsseldorf'] },
  { code: 'GB', name: 'Reino Unido', cities: ['Londres', 'Mánchester', 'Birmingham', 'Edimburgo', 'Glasgow', 'Liverpool', 'Leeds', 'Bristol'] },
  { code: 'NL', name: 'Países Bajos', cities: ['Ámsterdam', 'Róterdam', 'La Haya', 'Utrecht', 'Eindhoven'] },
  { code: 'BE', name: 'Bélgica', cities: ['Bruselas', 'Amberes', 'Gante', 'Brujas', 'Lieja'] },
  { code: 'CH', name: 'Suiza', cities: ['Zúrich', 'Ginebra', 'Basilea', 'Berna', 'Lausana'] },
  { code: 'AT', name: 'Austria', cities: ['Viena', 'Graz', 'Linz', 'Salzburgo', 'Innsbruck'] },
  { code: 'IE', name: 'Irlanda', cities: ['Dublín', 'Cork', 'Galway', 'Limerick'] },
  { code: 'SE', name: 'Suecia', cities: ['Estocolmo', 'Gotemburgo', 'Malmö', 'Uppsala'] },
  { code: 'NO', name: 'Noruega', cities: ['Oslo', 'Bergen', 'Trondheim', 'Stavanger'] },
  { code: 'DK', name: 'Dinamarca', cities: ['Copenhague', 'Aarhus', 'Odense', 'Aalborg'] },
  { code: 'FI', name: 'Finlandia', cities: ['Helsinki', 'Espoo', 'Tampere', 'Turku'] },
  { code: 'PL', name: 'Polonia', cities: ['Varsovia', 'Cracovia', 'Łódź', 'Breslavia', 'Poznań', 'Gdansk'] },
  { code: 'CZ', name: 'Chequia', cities: ['Praga', 'Brno', 'Ostrava'] },
  { code: 'GR', name: 'Grecia', cities: ['Atenas', 'Tesalónica', 'Patras', 'Heraclión'] },
  { code: 'TR', name: 'Turquía', cities: ['Estambul', 'Ankara', 'Esmirna', 'Bursa', 'Antalya'] },
  { code: 'RU', name: 'Rusia', cities: ['Moscú', 'San Petersburgo', 'Novosibirsk', 'Ekaterimburgo', 'Kazán'] },
  { code: 'UA', name: 'Ucrania', cities: ['Kiev', 'Járkov', 'Odesa', 'Leópolis', 'Dnipró'] },
  // ---- Asia y Oceanía ----
  { code: 'CN', name: 'China', cities: ['Pekín', 'Shanghái', 'Cantón', 'Shenzhen', 'Chongqing', 'Chengdu', 'Hangzhou', 'Wuhan', 'Hong Kong'] },
  { code: 'JP', name: 'Japón', cities: ['Tokio', 'Osaka', 'Yokohama', 'Nagoya', 'Sapporo', 'Kioto', 'Fukuoka'] },
  { code: 'KR', name: 'Corea del Sur', cities: ['Seúl', 'Busan', 'Incheon', 'Daegu', 'Daejeon'] },
  { code: 'IN', name: 'India', cities: ['Nueva Delhi', 'Bombay', 'Bangalore', 'Calcuta', 'Chennai', 'Hyderabad', 'Pune', 'Ahmedabad'] },
  { code: 'SG', name: 'Singapur', cities: ['Singapur'] },
  { code: 'TH', name: 'Tailandia', cities: ['Bangkok', 'Chiang Mai', 'Phuket', 'Pattaya'] },
  { code: 'VN', name: 'Vietnam', cities: ['Hanói', 'Ciudad Ho Chi Minh', 'Da Nang', 'Hai Phong'] },
  { code: 'ID', name: 'Indonesia', cities: ['Yakarta', 'Surabaya', 'Bandung', 'Medan', 'Bali (Denpasar)'] },
  { code: 'MY', name: 'Malasia', cities: ['Kuala Lumpur', 'George Town', 'Johor Bahru', 'Ipoh'] },
  { code: 'PH', name: 'Filipinas', cities: ['Manila', 'Ciudad Quezón', 'Davao', 'Cebú'] },
  { code: 'AE', name: 'Emiratos Árabes Unidos', cities: ['Dubái', 'Abu Dabi', 'Sharjah'] },
  { code: 'SA', name: 'Arabia Saudita', cities: ['Riad', 'Yeda', 'La Meca', 'Medina', 'Dammam'] },
  { code: 'IL', name: 'Israel', cities: ['Tel Aviv', 'Jerusalén', 'Haifa'] },
  { code: 'AU', name: 'Australia', cities: ['Sídney', 'Melbourne', 'Brisbane', 'Perth', 'Adelaida', 'Canberra'] },
  { code: 'NZ', name: 'Nueva Zelanda', cities: ['Auckland', 'Wellington', 'Christchurch'] },
  // ---- África ----
  { code: 'ZA', name: 'Sudáfrica', cities: ['Johannesburgo', 'Ciudad del Cabo', 'Durban', 'Pretoria'] },
  { code: 'EG', name: 'Egipto', cities: ['El Cairo', 'Alejandría', 'Guiza'] },
  { code: 'MA', name: 'Marruecos', cities: ['Casablanca', 'Rabat', 'Marrakech', 'Fez', 'Tánger'] },
  { code: 'NG', name: 'Nigeria', cities: ['Lagos', 'Abuya', 'Kano', 'Ibadán'] },
  { code: 'KE', name: 'Kenia', cities: ['Nairobi', 'Mombasa', 'Kisumu'] },
];

export function findGeoCountry(code: string | undefined): GeoCountry | undefined {
  if (!code) return undefined;
  const upper = code.trim().toUpperCase();
  return geoCountries.find((country) => country.code === upper);
}
