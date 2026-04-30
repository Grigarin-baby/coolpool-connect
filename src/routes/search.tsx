import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import {
  AutoComplete,
  Button,
  Empty,
  Form,
  List,
  Modal,
  Space,
  Spin,
  Tag,
  Typography,
  message,
} from "antd";
import { listTrips } from "@/data/appwrite-repository";
import { formatCurrency } from "@/lib/pricing";
import { appwriteConfig } from "@/integrations/appwrite/client";

interface PlacePrediction {
  description: string;
}

interface PlacesAutocompleteServiceLike {
  getPlacePredictions: (
    request: { input: string; types?: string[] },
    callback: (predictions: PlacePrediction[] | null, status: string) => void,
  ) => void;
}

interface GoogleMapsWindow {
  google?: {
    maps?: {
      places?: {
        AutocompleteService?: new () => PlacesAutocompleteServiceLike;
      };
    };
  };
}

export const Route = createFileRoute("/search")({
  head: () => ({
    meta: [
      { title: "Find a ride — Coolpool" },
      {
        name: "description",
        content: "Search available rides between cities. Filter by date, seats, and route.",
      },
    ],
  }),
  component: SearchPage,
});

function SearchPage() {
  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Awaited<ReturnType<typeof listTrips>>>([]);
  const [searched, setSearched] = useState(false);
  const [fromOptions, setFromOptions] = useState<{ value: string; label: string }[]>([]);
  const [toOptions, setToOptions] = useState<{ value: string; label: string }[]>([]);
  const autocompleteServiceRef = useRef<PlacesAutocompleteServiceLike | null>(null);

  useEffect(() => {
    const getService = () => {
      const maps = (window as Window & GoogleMapsWindow).google?.maps;
      if (!maps?.places?.AutocompleteService) return null;
      return new maps.places.AutocompleteService() as PlacesAutocompleteServiceLike;
    };

    const existingService = getService();
    if (existingService) {
      autocompleteServiceRef.current = existingService;
      return;
    }

    if (!appwriteConfig.googleMapsApiKey) return;

    const existingScript = document.querySelector(
      'script[data-google-maps="places"]',
    ) as HTMLScriptElement | null;
    const onLoaded = () => {
      const service = getService();
      if (service) autocompleteServiceRef.current = service;
    };

    if (existingScript) {
      if (existingScript.dataset.loaded === "true") {
        onLoaded();
      } else {
        existingScript.addEventListener("load", onLoaded, { once: true });
      }
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${appwriteConfig.googleMapsApiKey}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.dataset.googleMaps = "places";
    script.addEventListener(
      "load",
      () => {
        script.dataset.loaded = "true";
        onLoaded();
      },
      { once: true },
    );
    document.head.appendChild(script);
  }, []);

  const searchPlaces = (query: string, target: "from" | "to") => {
    if (!query || query.trim().length < 2) {
      if (target === "from") setFromOptions([]);
      else setToOptions([]);
      return;
    }

    const service = autocompleteServiceRef.current;
    if (!service) return;

    service.getPlacePredictions({ input: query, types: ["(cities)"] }, (predictions, status) => {
      if (status !== "OK" || !predictions) {
        if (target === "from") setFromOptions([]);
        else setToOptions([]);
        return;
      }

      const options = predictions.map((p) => ({ value: p.description, label: p.description }));
      if (target === "from") setFromOptions(options);
      else setToOptions(options);
    });
  };

  const normalizeLocation = (value: string) =>
    value.toLowerCase().split(",")[0].replace(/\s+/g, " ").trim();

  const matchesLocation = (tripLocation: string, searchLocation: string) => {
    const tripNorm = normalizeLocation(tripLocation);
    const searchNorm = normalizeLocation(searchLocation);
    if (!searchNorm) return true;
    return tripNorm.includes(searchNorm) || searchNorm.includes(tripNorm);
  };

  const onSearch = async (values: { from: string; to: string }) => {
    setLoading(true);
    try {
      const allTrips = await listTrips(200);
      const fromNeedle = values.from.trim();
      const toNeedle = values.to.trim();

      const filtered = allTrips
        .filter((trip) => {
          return (
            matchesLocation(trip.fromLocation, fromNeedle) &&
            matchesLocation(trip.toLocation, toNeedle)
          );
        })
        .sort((a, b) => new Date(a.departureAt).getTime() - new Date(b.departureAt).getTime());

      setResults(filtered);
      setSearched(true);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Unable to search trips.");
    } finally {
      setLoading(false);
    }
  };

  const summary = useMemo(() => {
    if (!searched) return "Search by entering from and to locations.";
    return results.length > 0 ? `${results.length} trip(s) found` : "No matching trips found";
  }, [searched, results.length]);

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="container mx-auto px-4 py-16 max-w-6xl flex-1">
        <Modal
          open={open}
          onCancel={() => setOpen(false)}
          footer={null}
          title="Find a trip"
          width={820}
          centered
          destroyOnHidden={false}
        >
          <Form layout="vertical" onFinish={onSearch} initialValues={{ from: "", to: "" }}>
            <div className="grid md:grid-cols-2 gap-4">
              <Form.Item
                label="From"
                name="from"
                rules={[{ required: true, message: "Please enter source location" }]}
              >
                <AutoComplete
                  options={fromOptions}
                  onSearch={(text) => searchPlaces(text, "from")}
                  placeholder="e.g. Kolkata"
                />
              </Form.Item>
              <Form.Item
                label="To"
                name="to"
                rules={[{ required: true, message: "Please enter destination location" }]}
              >
                <AutoComplete
                  options={toOptions}
                  onSearch={(text) => searchPlaces(text, "to")}
                  placeholder="e.g. Durgapur"
                />
              </Form.Item>
            </div>

            <Space className="w-full justify-between mt-1 mb-4">
              <Typography.Text type="secondary">{summary}</Typography.Text>
              <Button type="primary" htmlType="submit" loading={loading}>
                Search trips
              </Button>
            </Space>
          </Form>

          {loading && (
            <div className="py-10 flex justify-center">
              <Spin />
            </div>
          )}

          {!loading && searched && results.length === 0 && (
            <Empty description="No trips match this route yet." />
          )}

          {!loading && results.length > 0 && (
            <List
              itemLayout="vertical"
              dataSource={results}
              renderItem={(trip) => (
                <List.Item key={trip.id}>
                  <div className="rounded-xl border border-border/60 bg-card/60 p-4">
                    <Space className="w-full justify-between" align="start">
                      <div>
                        <Typography.Title level={5} style={{ margin: 0 }}>
                          {trip.fromLocation} → {trip.toLocation}
                        </Typography.Title>
                        <Typography.Text type="secondary">
                          Departure: {new Date(trip.departureAt).toLocaleString()}
                        </Typography.Text>
                      </div>
                      <Space>
                        <Tag color="purple">{trip.totalSeats} seats</Tag>
                        <Tag color="blue">{formatCurrency(trip.totalPrice)}</Tag>
                      </Space>
                    </Space>
                  </div>
                </List.Item>
              )}
            />
          )}
        </Modal>
      </main>
      <SiteFooter />
    </div>
  );
}
