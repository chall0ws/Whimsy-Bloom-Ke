import { describe, expect, it } from 'vitest'
import { readyMessage, whatsappLink, whatsappNumber } from './whatsapp'

describe('WhatsApp messages', () => {
  it('turns Kenyan numbers into the international form', () => {
    expect(whatsappNumber('0712 345 678')).toBe('254712345678')
    expect(whatsappNumber('+254 712 345 678')).toBe('254712345678')
    expect(whatsappNumber('712345678')).toBe('254712345678')
    expect(whatsappNumber('0110 123 456')).toBe('254110123456')
    expect(whatsappNumber('12')).toBeNull()
    expect(whatsappNumber(undefined)).toBeNull()
  })

  it('writes the ready message with the balance, its parts and the payment link', () => {
    const text = readyMessage({ firstName: 'Joy', number: 'WB-1001', summary: 'Golden Hour', delivery: 'Outside Nairobi · Easy Coach', remaining: 2100, deliveryFee: 400, balance: 2500, payUrl: 'https://shop/#/thanks/o-1' })
    expect(text).toContain('Hi Joy! 🌸 Your Whimsy & Bloom order WB-1001 (Golden Hour) is ready.')
    expect(text).toContain('Balance to pay: KES 2,500')
    expect(text).toContain('• Remaining 50%: KES 2,100')
    expect(text).toContain('• Delivery (Outside Nairobi · Easy Coach): KES 400')
    expect(text).toContain('https://shop/#/thanks/o-1')
    expect(text).not.toContain('Here it is')
    const withPhoto = readyMessage({ firstName: 'Joy', number: 'WB-1001', summary: 'Golden Hour', delivery: 'Within Nairobi · Rider', remaining: 0, deliveryFee: 0, balance: 0, payUrl: '', photoUrls: ['https://photos/o-1.jpg'] })
    expect(withPhoto).toContain('Here it is: https://photos/o-1.jpg')
    const two = readyMessage({ firstName: 'Joy', number: 'WB-1001', summary: 'Golden Hour', delivery: 'Outside Kenya', remaining: 0, deliveryFee: 0, balance: 0, payUrl: '', photoUrls: ['https://p/1.jpg', 'https://p/2.jpg'] })
    expect(two).toContain('Here it is:\nhttps://p/1.jpg\nhttps://p/2.jpg')
    expect(withPhoto).toContain('fully paid')
    expect(whatsappLink('254712345678', 'Hi & bye')).toBe('https://wa.me/254712345678?text=Hi%20%26%20bye')
  })
})
