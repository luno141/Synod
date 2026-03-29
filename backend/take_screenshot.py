import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.firefox.launch()
        page = await browser.new_page()
        await page.goto('http://localhost:3001')
        # Wait a bit for animations or dynamic content
        await page.wait_for_timeout(2000)
        await page.screenshot(path='/home/luno/Desktop/WORK/SYNOD/frontend/synod_ui_firefox.png', full_page=True)
        await browser.close()

asyncio.run(main())
