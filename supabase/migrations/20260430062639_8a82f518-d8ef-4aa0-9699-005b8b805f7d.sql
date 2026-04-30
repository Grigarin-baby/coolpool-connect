
-- ============= ROLES =============
CREATE TYPE public.app_role AS ENUM ('admin', 'host', 'traveler');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users view their own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage all roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============= PROFILES =============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  host_rating NUMERIC(3,2) DEFAULT 5.00,
  total_trips_hosted INT NOT NULL DEFAULT 0,
  total_trips_taken INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are viewable by everyone" ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users insert own profile" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins manage all profiles" ON public.profiles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Auto-create profile + traveler role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'traveler');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============= TRIPS =============
CREATE TYPE public.trip_status AS ENUM ('scheduled', 'in_progress', 'completed', 'cancelled');

CREATE TABLE public.trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  from_location TEXT NOT NULL,
  to_location TEXT NOT NULL,
  from_lat DOUBLE PRECISION NOT NULL,
  from_lng DOUBLE PRECISION NOT NULL,
  to_lat DOUBLE PRECISION NOT NULL,
  to_lng DOUBLE PRECISION NOT NULL,
  total_distance_km NUMERIC(10,2) NOT NULL,
  total_price NUMERIC(10,2) NOT NULL,
  price_per_km NUMERIC(10,4) NOT NULL,
  total_seats INT NOT NULL CHECK (total_seats > 0 AND total_seats <= 8),
  departure_at TIMESTAMPTZ NOT NULL,
  polyline TEXT NOT NULL,
  notes TEXT,
  status trip_status NOT NULL DEFAULT 'scheduled',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_trips_departure ON public.trips(departure_at);
CREATE INDEX idx_trips_host ON public.trips(host_id);
CREATE INDEX idx_trips_status ON public.trips(status);

ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active trips viewable by everyone" ON public.trips
  FOR SELECT USING (status IN ('scheduled', 'in_progress') OR auth.uid() = host_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Hosts create their own trips" ON public.trips
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = host_id AND public.has_role(auth.uid(), 'host'));

CREATE POLICY "Hosts update their own trips" ON public.trips
  FOR UPDATE TO authenticated
  USING (auth.uid() = host_id);

CREATE POLICY "Hosts delete their own trips" ON public.trips
  FOR DELETE TO authenticated
  USING (auth.uid() = host_id);

CREATE POLICY "Admins manage all trips" ON public.trips
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============= TRIP STOPS =============
CREATE TYPE public.stop_type AS ENUM ('pickup', 'drop', 'both');

CREATE TABLE public.trip_stops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  stop_index INT NOT NULL, -- 0 = origin, last = destination
  location TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  distance_from_origin_km NUMERIC(10,2) NOT NULL,
  stop_type stop_type NOT NULL DEFAULT 'both',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (trip_id, stop_index)
);

CREATE INDEX idx_trip_stops_trip ON public.trip_stops(trip_id);

ALTER TABLE public.trip_stops ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trip stops viewable by everyone" ON public.trip_stops
  FOR SELECT USING (true);

CREATE POLICY "Hosts manage their trip stops" ON public.trip_stops
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.trips t WHERE t.id = trip_id AND t.host_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.trips t WHERE t.id = trip_id AND t.host_id = auth.uid()));

CREATE POLICY "Admins manage all trip stops" ON public.trip_stops
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============= BOOKINGS =============
CREATE TYPE public.booking_status AS ENUM ('pending', 'confirmed', 'cancelled', 'completed');

CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  traveler_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  from_stop_index INT NOT NULL,
  to_stop_index INT NOT NULL,
  seats_booked INT NOT NULL CHECK (seats_booked > 0 AND seats_booked <= 8),
  segment_price NUMERIC(10,2) NOT NULL,
  passenger_name TEXT NOT NULL,
  passenger_phone TEXT NOT NULL,
  status booking_status NOT NULL DEFAULT 'confirmed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (to_stop_index > from_stop_index)
);

CREATE INDEX idx_bookings_trip ON public.bookings(trip_id);
CREATE INDEX idx_bookings_traveler ON public.bookings(traveler_id);

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Travelers view their own bookings" ON public.bookings
  FOR SELECT TO authenticated
  USING (
    auth.uid() = traveler_id
    OR EXISTS (SELECT 1 FROM public.trips t WHERE t.id = trip_id AND t.host_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Travelers create own bookings" ON public.bookings
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = traveler_id);

CREATE POLICY "Travelers update own bookings" ON public.bookings
  FOR UPDATE TO authenticated
  USING (auth.uid() = traveler_id OR EXISTS (SELECT 1 FROM public.trips t WHERE t.id = trip_id AND t.host_id = auth.uid()));

CREATE POLICY "Admins manage all bookings" ON public.bookings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============= PRICING RULES =============
CREATE TABLE public.pricing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  min_price_per_km NUMERIC(10,4) NOT NULL DEFAULT 2.00,
  max_price_per_km NUMERIC(10,4) NOT NULL DEFAULT 20.00,
  route_match_tolerance_km NUMERIC(5,2) NOT NULL DEFAULT 5.00,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.pricing_rules (min_price_per_km, max_price_per_km, route_match_tolerance_km)
VALUES (2.00, 20.00, 5.00);

ALTER TABLE public.pricing_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pricing rules viewable by everyone" ON public.pricing_rules
  FOR SELECT USING (true);

CREATE POLICY "Admins manage pricing rules" ON public.pricing_rules
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============= UPDATED_AT TRIGGERS =============
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_trips_updated BEFORE UPDATE ON public.trips FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_bookings_updated BEFORE UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
