import { beforeEach, describe, expect, it, type Mock } from 'vitest';
import { getCookie, removeCookie, resolveTabUrl, setCookie } from '@/background/cookies';

const tabsGet = chrome.tabs.get as unknown as Mock;
const cookiesGet = chrome.cookies.get as unknown as Mock;
const cookiesSet = chrome.cookies.set as unknown as Mock;
const cookiesRemove = chrome.cookies.remove as unknown as Mock;

describe('cookies background', () => {
  beforeEach(() => {
    tabsGet.mockReset();
    cookiesGet.mockReset();
    cookiesSet.mockReset();
    cookiesRemove.mockReset();
    tabsGet.mockResolvedValue({ id: 1, url: 'https://example.com/admin/' });
  });

  describe('resolveTabUrl', () => {
    it('returns the URL for http(s)/file schemes', async () => {
      tabsGet.mockResolvedValueOnce({ id: 1, url: 'https://example.com/admin/' });
      const url = await resolveTabUrl(1);
      expect(url.toString()).toBe('https://example.com/admin/');
    });

    it('throws when the tab has no URL', async () => {
      tabsGet.mockResolvedValueOnce({ id: 1 });
      await expect(resolveTabUrl(1)).rejects.toThrow('Tab has no URL');
    });

    it('throws for unsupported schemes (chrome://)', async () => {
      tabsGet.mockResolvedValueOnce({ id: 1, url: 'chrome://extensions' });
      await expect(resolveTabUrl(1)).rejects.toThrow('Unsupported scheme: chrome:');
    });
  });

  describe('getCookie', () => {
    it('uses the tab URL with the configured path (cookies scoped to non-root paths are found)', async () => {
      tabsGet.mockResolvedValueOnce({ id: 1, url: 'https://example.com/' });
      cookiesGet.mockResolvedValueOnce({ name: 'sessionid', value: 'abc', path: '/api/admin/' });
      const cookie = await getCookie(1, 'sessionid', '/api/admin/');
      expect(cookiesGet).toHaveBeenCalledWith({
        url: 'https://example.com/api/admin/',
        name: 'sessionid',
      });
      expect(cookie?.value).toBe('abc');
    });

    it('defaults path to / when none provided', async () => {
      tabsGet.mockResolvedValueOnce({ id: 1, url: 'https://example.com/admin/login' });
      cookiesGet.mockResolvedValueOnce({ name: 'csrftoken', value: 'tk' });
      await getCookie(1, 'csrftoken');
      expect(cookiesGet).toHaveBeenCalledWith({
        url: 'https://example.com/',
        name: 'csrftoken',
      });
    });

    it('returns null when chrome.cookies.get resolves null', async () => {
      cookiesGet.mockResolvedValueOnce(null);
      const cookie = await getCookie(1, 'missing');
      expect(cookie).toBeNull();
    });
  });

  describe('setCookie', () => {
    it('passes path explicitly so cookies land at the configured scope', async () => {
      tabsGet.mockResolvedValueOnce({ id: 1, url: 'https://example.com/anywhere' });
      cookiesSet.mockResolvedValueOnce({ name: 'app_locale', value: 'en' });
      await setCookie({ tabId: 1, name: 'app_locale', value: 'en', path: '/' });
      expect(cookiesSet).toHaveBeenCalledWith({
        url: 'https://example.com/',
        name: 'app_locale',
        value: 'en',
        path: '/',
      });
    });

    it('defaults path to / when not provided', async () => {
      cookiesSet.mockResolvedValueOnce({ name: 'foo', value: 'bar' });
      await setCookie({ tabId: 1, name: 'foo', value: 'bar' });
      const args = cookiesSet.mock.calls[0]?.[0];
      expect(args.path).toBe('/');
    });

    it('does NOT pass domain / secure / sameSite — Chrome derives them from the URL', async () => {
      cookiesSet.mockResolvedValueOnce({ name: 'foo', value: 'bar' });
      await setCookie({ tabId: 1, name: 'foo', value: 'bar', path: '/' });
      const args = cookiesSet.mock.calls[0]?.[0];
      expect(args.domain).toBeUndefined();
      expect(args.secure).toBeUndefined();
      expect(args.sameSite).toBeUndefined();
    });
  });

  describe('removeCookie', () => {
    it('uses the configured path on the URL so non-root cookies are correctly targeted', async () => {
      tabsGet.mockResolvedValueOnce({ id: 1, url: 'https://example.com/' });
      cookiesRemove.mockResolvedValueOnce({ name: 'sessionid' });
      await removeCookie(1, 'sessionid', '/api/admin/');
      expect(cookiesRemove).toHaveBeenCalledWith({
        url: 'https://example.com/api/admin/',
        name: 'sessionid',
      });
    });
  });
});
