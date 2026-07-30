import { ConfigService } from '@nestjs/config'

import { NewsMediaDispatcherFactory, NewsMediaDnsResolver, NewsMediaRemoteFetcher } from './news-media.service'

describe('NewsMediaRemoteFetcher URL policy', () => {
    const config = new ConfigService({
        NEWS_MEDIA_IMPORT_MAX_REDIRECTS: 3,
        NEWS_MEDIA_IMPORT_MAX_BYTES: 1024,
        NEWS_MEDIA_IMPORT_TIMEOUT_MS: 1000,
    })
    const fetcher = new NewsMediaRemoteFetcher(config, new NewsMediaDnsResolver(), new NewsMediaDispatcherFactory())

    it.each([
        'http://localhost/a.png',
        'http://127.0.0.1/a.png',
        'http://192.168.1.1/a.png',
        'http://user:pass@example.com/a.png',
        'http://example.com:8080/a.png',
    ])('rejects forbidden URL %s', async url => {
        await expect(fetcher.fetch(url)).rejects.toThrow()
    })

    it('rejects an IPv6 loopback URL', async () => {
        await expect(fetcher.fetch('http://[::1]/a.png')).rejects.toThrow()
    })
})
