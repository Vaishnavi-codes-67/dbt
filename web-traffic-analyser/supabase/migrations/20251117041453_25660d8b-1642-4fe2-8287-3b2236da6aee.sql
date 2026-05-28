-- Create profiles table for user information
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  full_name text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Create traffic events table
CREATE TABLE public.traffic_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  page_path text NOT NULL,
  referrer text,
  country text,
  device_type text,
  browser text,
  session_id text,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.traffic_events ENABLE ROW LEVEL SECURITY;

-- Traffic events policies
CREATE POLICY "Users can view own traffic"
  ON public.traffic_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own traffic"
  ON public.traffic_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create websites table
CREATE TABLE public.websites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  domain text NOT NULL,
  tracking_code text DEFAULT gen_random_uuid()::text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.websites ENABLE ROW LEVEL SECURITY;

-- Websites policies
CREATE POLICY "Users can view own websites"
  ON public.websites FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own websites"
  ON public.websites FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own websites"
  ON public.websites FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own websites"
  ON public.websites FOR DELETE
  USING (auth.uid() = user_id);

-- Function to automatically create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', '')
  );
  RETURN new;
END;
$$;

-- Trigger to create profile on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_websites_updated_at
  BEFORE UPDATE ON public.websites
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();