import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, Typography, Form, InputNumber, Button, message, Spin } from "antd";
import { getPricingRule, updatePricingRule } from "@/data/appwrite-repository";
import type { UpdatePricingRuleInput } from "@/data/appwrite-repository";

const { Title, Text } = Typography;

export function PricingPanel() {
  const queryClient = useQueryClient();
  const [form] = Form.useForm<UpdatePricingRuleInput>();

  const { data: rule, isLoading } = useQuery({
    queryKey: ["admin-pricing-rule"],
    queryFn: getPricingRule,
  });

  useEffect(() => {
    if (rule) {
      form.setFieldsValue({
        minPricePerKm: rule.minPricePerKm,
        maxPricePerKm: rule.maxPricePerKm,
        routeMatchToleranceKm: rule.routeMatchToleranceKm,
      });
    }
  }, [rule, form]);

  const updateMutation = useMutation({
    mutationFn: updatePricingRule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-pricing-rule"] });
      message.success("Pricing rule updated");
    },
    onError: (error: any) => message.error(error.message),
  });

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="flex flex-col gap-1">
        <Title level={2} style={{ margin: 0 }}>
          Pricing Rules
        </Title>
        <Text type="secondary">
          Set the platform-wide allowed range for price-per-km and route matching tolerance.
        </Text>
      </div>

      <Card className="rounded-3xl border-none shadow-card bg-white/90 backdrop-blur-md max-w-xl p-4">
        {isLoading ? (
          <Spin />
        ) : (
          <Form
            form={form}
            layout="vertical"
            onFinish={(values) => updateMutation.mutate(values)}
          >
            <Form.Item
              label="Minimum price per km (₹)"
              name="minPricePerKm"
              rules={[{ required: true, message: "Required" }]}
            >
              <InputNumber min={0} step={0.5} className="w-full" />
            </Form.Item>
            <Form.Item
              label="Maximum price per km (₹)"
              name="maxPricePerKm"
              rules={[{ required: true, message: "Required" }]}
            >
              <InputNumber min={0} step={0.5} className="w-full" />
            </Form.Item>
            <Form.Item
              label="Route match tolerance (km)"
              name="routeMatchToleranceKm"
              rules={[{ required: true, message: "Required" }]}
            >
              <InputNumber min={0} step={1} className="w-full" />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={updateMutation.isPending}>
              Save changes
            </Button>
          </Form>
        )}
      </Card>
    </div>
  );
}
