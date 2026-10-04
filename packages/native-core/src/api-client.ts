export class MarketFitNativeApi {
  constructor(
    private readonly baseUrl: string,
    private readonly getAccessToken: () => Promise<string | null>,
  ) {}

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = await this.getAccessToken()
    if (!token) throw new Error("No MarketFit session is available.")

    const response = await fetch(new URL(path, this.baseUrl), {
      ...init,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
        ...(init.headers || {}),
      },
    })

    const body = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(body?.error || `MarketFit API failed with ${response.status}`)
    }
    return body as T
  }

  bootstrap() {
    return this.request("/api/native/bootstrap")
  }

  registerDevice(deviceKey: string, platform: "android" | "ios" | "windows" | "macos", label?: string) {
    return this.request("/api/identity/device/register", {
      method: "POST",
      body: JSON.stringify({
        deviceKey,
        channel: "mobile",
        label: label || `MarketFit ${platform}`,
      }),
    })
  }

  generateInterviewAnswer(payload: {
    question: string
    transcript: Array<{ role: string; text: string }>
    sessionId?: string
  }) {
    return this.request("/api/assist", {
      method: "POST",
      body: JSON.stringify(payload),
    })
  }
}
