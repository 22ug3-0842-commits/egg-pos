'use client'

import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import * as XLSX from 'xlsx'

interface EggBatch {
  id: number
  created_at: string
  item_name: string
  purchase_price: number
  selling_price: number
  quantity: number
  remaining_quantity: number
  eggs_per_box: number
}

interface UserIssuedStock {
  id: number
  user_email: string
  batch_id: number
  batch_name: string
  issued_quantity: number
  remaining_quantity: number
  date: string
}

interface CartItem {
  batch: UserIssuedStock
  quantity: number
  sellType: 'single' | 'box'
  damagedExchangeQty: number
  sellingPrice: number
  eggsPerBox: number
}

interface Customer {
  id: number
  name: string
  phone: string
  credit_balance: number
}

interface ReceiptData {
  saleId: number
  items: CartItem[]
  totalAmount: number
  cashPaid: number
  balance: number
  date: string
  customerName?: string
  paymentType: string
  damagedDiscount: number
}

interface UserProfile {
  id: string
  email: string
  role: 'admin' | 'user'
}

interface ItemSummary {
  itemName: string
  qtySold: number
  revenue: number
}

interface UserSummary {
  userEmail: string
  qtySold: number
  revenue: number
}

export default function Home() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [createRole, setCreateRole] = useState<'admin' | 'user'>('user')

  const [activeTab, setActiveTab] = useState<'sales' | 'my_history' | 'stock' | 'issue' | 'reports' | 'customers' | 'users'>('sales')
  const [mainBatches, setMainBatches] = useState<EggBatch[]>([])
  const [myIssuedStock, setMyIssuedStock] = useState<UserIssuedStock[]>([])
  const [allUserIssuedStocks, setAllUserIssuedStocks] = useState<UserIssuedStock[]>([])
  const [userList, setUserList] = useState<UserProfile[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])

  // Cart & Checkout
  const [cart, setCart] = useState<CartItem[]>([])
  const [cashPaid, setCashPaid] = useState<string>('')
  const [selectedCustomer, setSelectedCustomer] = useState<string>('')
  const [paymentType, setPaymentType] = useState<'cash' | 'credit'>('cash')
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [receipt, setReceipt] = useState<ReceiptData | null>(null)

  // My Sales History & Daily Summary
  const [mySales, setMySales] = useState<any[]>([])
  const [myTodayCashInHand, setMyTodayCashInHand] = useState(0)
  const [myTodayEggsSold, setMyTodayEggsSold] = useState(0)
  const [myTodayDamagedEggs, setMyTodayDamagedEggs] = useState(0)
  const [selectedSaleDetail, setSelectedSaleDetail] = useState<any | null>(null)

  // Customers
  const [newCustName, setNewCustName] = useState('')
  const [newCustPhone, setNewCustPhone] = useState('')

  // Admin New Batch
  const [newBatchName, setNewBatchName] = useState('White Eggs (සුදු බිත්තර)')
  const [newPurchasePrice, setNewPurchasePrice] = useState('')
  const [newSellingPrice, setNewSellingPrice] = useState('')
  const [boxCount, setBoxCount] = useState('')
  const [eggsPerBox, setEggsPerBox] = useState('300')

  // Issue Stock State
  const [selectedUserEmail, setSelectedUserEmail] = useState<string>('')
  const [selectedMainBatchId, setSelectedMainBatchId] = useState<string>('')
  const [issueQty, setIssueQty] = useState<string>('')
  const [issueDate, setIssueDate] = useState<string>(new Date().toISOString().split('T')[0])

  // Reports state
  const [selectedReportDate, setSelectedReportDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [todayRevenue, setTodayRevenue] = useState(0)
  const [todayProfit, setTodayProfit] = useState(0)
  const [itemSummaries, setItemSummaries] = useState<ItemSummary[]>([])
  const [userReportSummaries, setUserReportSummaries] = useState<UserSummary[]>([])
  const [totalDamagedEggs, setTotalDamagedEggs] = useState(0)

  // Security Delete Password
  const ADMIN_DELETE_PASSWORD = '1234'

  useEffect(() => {
    checkUser()
    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      checkUser()
    })
    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [])

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single()

      if (profile) {
        setCurrentUser({ id: profile.id, email: profile.email, role: profile.role })
      } else {
        setCurrentUser({ id: session.user.id, email: session.user.email || '', role: 'user' })
      }
    } else {
      setCurrentUser(null)
    }
    setAuthLoading(false)
  }

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return alert('Email and password required!')

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { role: createRole } }
      })
      if (error) return alert(error.message)
      alert('නව පරිශීලකයා සාර්ථකව සෑදූ අතර Profiles පද්ධතියට එකතු විය!')
      setEmail('')
      setPassword('')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) return alert(error.message)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setCurrentUser(null)
  }

  const isToday = (dateString: string) => new Date(dateString).toDateString() === new Date().toDateString()

  const fetchMainBatches = async () => {
    const { data } = await supabase.from('egg_batches').select('*').order('id', { ascending: true })
    if (data) setMainBatches(data)
  }

  const fetchMyIssuedStock = async (userEmail?: string) => {
    const emailToUse = userEmail || currentUser?.email
    if (!emailToUse) return

    const { data, error } = await supabase
      .from('user_issued_stocks')
      .select('*')
      .ilike('user_email', emailToUse.trim())

    if (error) {
      console.error('Error fetching user stock:', error)
    } else if (data) {
      setMyIssuedStock(data)
    }
  }

  const fetchMySalesHistory = async () => {
    if (!currentUser?.email) return

    const { data, error } = await supabase
      .from('sales')
      .select(`
        id, created_at, total_amount, payment_type, damaged_discount, customer_id, customers(name),
        sale_items ( id, batch_id, quantity_eggs, unit_price, total_amount, damaged_qty, egg_batches(item_name) )
      `)
      .ilike('user_email', currentUser.email.trim())
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching sales history:', error)
      return
    }

    if (data) {
      setMySales(data)

      let todayCash = 0
      let todayEggs = 0
      let todayDamaged = 0

      data.forEach((sale: any) => {
        if (isToday(sale.created_at)) {
          if (sale.payment_type === 'cash') {
            todayCash += Number(sale.total_amount) || 0
          }
          sale.sale_items?.forEach((item: any) => {
            todayEggs += Number(item.quantity_eggs) || 0
            todayDamaged += Number(item.damaged_qty) || 0
          })
        }
      })

      setMyTodayCashInHand(todayCash)
      setMyTodayEggsSold(todayEggs)
      setMyTodayDamagedEggs(todayDamaged)
    }
  }

  const fetchAllUserIssuedStocks = async () => {
    const { data } = await supabase.from('user_issued_stocks').select('*').order('id', { ascending: false })
    if (data) setAllUserIssuedStocks(data)
  }

  const fetchUserList = async () => {
    const { data } = await supabase.from('profiles').select('*')
    if (data) setUserList(data)
  }

  const fetchCustomers = async () => {
    const { data } = await supabase.from('customers').select('*').order('name', { ascending: true })
    if (data) setCustomers(data)
  }

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCustName) return alert('නම ඇතුළත් කරන්න!')
    const { error } = await supabase.from('customers').insert([{ name: newCustName, phone: newCustPhone, credit_balance: 0 }])
    if (error) return alert(error.message)
    alert('පාරිභෝගිකයා සාර්ථකව එකතු කරන ලදී!')
    setNewCustName(''); setNewCustPhone('')
    fetchCustomers()
  }

  useEffect(() => {
    if (currentUser) {
      fetchMainBatches()
      fetchMyIssuedStock(currentUser.email)
      fetchMySalesHistory()
      fetchCustomers()
      if (currentUser.role === 'admin') {
        fetchAllUserIssuedStocks()
        fetchUserList()
      }
    }
  }, [currentUser])

  useEffect(() => {
    if (activeTab === 'reports') fetchReports()
    if (activeTab === 'my_history') fetchMySalesHistory()
    if (activeTab === 'sales' && currentUser) {
      fetchMyIssuedStock(currentUser.email)
      fetchMySalesHistory()
    }
  }, [activeTab])

  const clearCart = () => {
    setCart([])
    setCashPaid('')
  }

  const handleAddBatch = async (e: React.FormEvent) => {
    e.preventDefault()
    const pPrice = parseFloat(newPurchasePrice)
    const sPrice = parseFloat(newSellingPrice)
    const boxes = parseInt(boxCount)
    const perBox = parseInt(eggsPerBox) || 300

    if (!pPrice || !sPrice || !boxes || !perBox) return alert('සියලු විස්තර ඇතුළත් කරන්න!')
    const totalEggs = boxes * perBox

    try {
      const { error } = await supabase.from('egg_batches').insert([{
        item_name: newBatchName,
        purchase_price: pPrice,
        selling_price: sPrice,
        quantity: totalEggs,
        remaining_quantity: totalEggs,
        eggs_per_box: perBox
      }])
      if (error) throw error
      alert('ප්‍රධාන ගබඩාවට නව බිත්තර තොගය සාර්ථකව එකතු කළා!')
      setNewPurchasePrice(''); setNewSellingPrice(''); setBoxCount('')
      fetchMainBatches()
    } catch (err: any) {
      alert('Error: ' + err.message)
    }
  }

  const handleIssueStockToUser = async (e: React.FormEvent) => {
    e.preventDefault()
    const bId = parseInt(selectedMainBatchId)
    const qty = parseInt(issueQty)

    if (!selectedUserEmail || !bId || !qty || qty <= 0 || !issueDate) return alert('සියලු තොරතුරු සහ දිනය නිවැරදිව තෝරන්න!')

    const targetBatch = mainBatches.find(b => b.id === bId)
    if (!targetBatch || targetBatch.remaining_quantity < qty) return alert('ප්‍රධාන ගබඩාවේ ප්‍රමාණවත් තොග නොමැත!')

    try {
      await supabase.from('egg_batches').update({
        remaining_quantity: targetBatch.remaining_quantity - qty
      }).eq('id', bId)

      await supabase.from('user_issued_stocks').insert([{
        user_email: selectedUserEmail.trim().toLowerCase(),
        batch_id: bId,
        batch_name: targetBatch.item_name,
        issued_quantity: qty,
        remaining_quantity: qty,
        date: new Date(issueDate).toISOString()
      }])

      alert(`${selectedUserEmail} වෙත බිත්තර ${qty} සාර්ථකව ලබා දෙන ලදී!`)
      setIssueQty('')
      fetchMainBatches()
      fetchAllUserIssuedStocks()
      if (currentUser) fetchMyIssuedStock(currentUser.email)
    } catch (err: any) {
      alert('Error: ' + err.message)
    }
  }

  const handleDeleteIssuedStock = async (stockItem: UserIssuedStock) => {
    const inputPass = prompt("මෙම තොගය නිකුත් කිරීම මකා දැමීමට Admin මුරපදය (Password) ඇතුළත් කරන්න:")
    if (inputPass !== ADMIN_DELETE_PASSWORD) {
      return alert("ඇතුළත් කළ මුරපදය වැරදියි! මකා දැමීමට අවසර නැත.")
    }

    try {
      const { data: mainBatch } = await supabase.from('egg_batches').select('remaining_quantity').eq('id', stockItem.batch_id).single()
      if (mainBatch) {
        await supabase.from('egg_batches').update({
          remaining_quantity: mainBatch.remaining_quantity + stockItem.remaining_quantity
        }).eq('id', stockItem.batch_id)
      }

      const { error } = await supabase.from('user_issued_stocks').delete().eq('id', stockItem.id)
      if (error) throw error

      alert("නිකුත් කරන ලද තොගය සාර්ථකව මකා දැමූ අතර, ඉතිරි බිත්තර ප්‍රමාණය නැවත ප්‍රධාන ගබඩාවට එකතු විය!")
      fetchMainBatches()
      fetchAllUserIssuedStocks()
      if (currentUser) fetchMyIssuedStock(currentUser.email)
    } catch (err: any) {
      alert("Error deleting stock: " + err.message)
    }
  }

  const addToCart = (issuedStock: UserIssuedStock, sellType: 'single' | 'box' = 'single') => {
    const mainBatch = mainBatches.find(b => b.id === issuedStock.batch_id)
    const boxSize = mainBatch?.eggs_per_box || 300
    const sellingPrice = mainBatch?.selling_price || 0

    const currentInCart = cart.reduce((sum, item) => {
      if (item.batch.id === issuedStock.id) {
        return sum + (item.sellType === 'box' ? item.quantity * item.eggsPerBox : item.quantity)
      }
      return sum
    }, 0)

    const newlyNeededEggs = sellType === 'box' ? boxSize : 1

    if (issuedStock.remaining_quantity < (currentInCart + newlyNeededEggs)) {
      return alert('ඔබට ලබාදී ඇති තොගයේ ප්‍රමාණවත් බිත්තර නොමැත!')
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.batch.id === issuedStock.id && item.sellType === sellType)
      if (existing) {
        return prev.map((item) =>
          item.batch.id === issuedStock.id && item.sellType === sellType ? { ...item, quantity: item.quantity + 1 } : item
        )
      }
      return [...prev, { batch: issuedStock, quantity: 1, sellType, damagedExchangeQty: 0, sellingPrice, eggsPerBox: boxSize }]
    })
  }

  const updateQuantity = (issuedStockId: number, sellType: 'single' | 'box', qty: number, damagedQty: number = 0) => {
    if (qty <= 0) {
      setCart((prev) => prev.filter((item) => !(item.batch.id === issuedStockId && item.sellType === sellType)))
    } else {
      setCart((prev) =>
        prev.map((item) =>
          item.batch.id === issuedStockId && item.sellType === sellType ? { ...item, quantity: qty, damagedExchangeQty: damagedQty } : item
        )
      )
    }
  }

  const rawTotalAmount = cart.reduce((sum, item) => {
    const itemPrice = item.sellType === 'box' ? item.sellingPrice * item.eggsPerBox * item.quantity : item.sellingPrice * item.quantity
    return sum + itemPrice
  }, 0)

  const totalDamagedDiscount = cart.reduce((sum, item) => sum + (item.damagedExchangeQty * item.sellingPrice), 0)
  const netTotalAmount = Math.max(0, rawTotalAmount - totalDamagedDiscount)
  const calculatedBalance = Math.max(0, (parseFloat(cashPaid) || 0) - netTotalAmount)

  const handleCheckout = async () => {
    if (cart.length === 0) return alert('Cart එක හිස්ව පවතී!')
    const cash = parseFloat(cashPaid) || 0

    if (paymentType === 'cash' && cash < netTotalAmount) return alert('ගෙවූ මුදල ප්‍රමාණවත් නොවේ! කරුණාකර නිවැරදි මුදල ඇතුළත් කරන්න.')
    if (paymentType === 'credit' && !selectedCustomer) return alert('ණයට ලබා ගැනීමට පාරිභෝගිකයා තෝරන්න!')

    setCheckoutLoading(true)
    try {
      const custId = selectedCustomer ? parseInt(selectedCustomer) : null
      const custObj = customers.find((c) => c.id === custId)

      const { data: sale, error: saleError } = await supabase
        .from('sales')
        .insert([{
          total_amount: netTotalAmount,
          customer_id: custId,
          payment_type: paymentType,
          damaged_discount: totalDamagedDiscount,
          user_email: currentUser?.email?.trim().toLowerCase()
        }])
        .select()
        .single()

      if (saleError) throw saleError

      for (const item of cart) {
        const totalEggsSold = item.sellType === 'box' ? item.quantity * item.eggsPerBox : item.quantity
        const itemTotal = item.sellType === 'box' ? item.sellingPrice * item.eggsPerBox * item.quantity : item.sellingPrice * item.quantity

        await supabase.from('sale_items').insert([{
          sale_id: sale.id,
          batch_id: item.batch.batch_id,
          quantity_eggs: totalEggsSold,
          unit_price: item.sellingPrice,
          total_amount: itemTotal,
          damaged_qty: item.damagedExchangeQty
        }])

        const { data: currentDbStock } = await supabase
          .from('user_issued_stocks')
          .select('remaining_quantity')
          .eq('id', item.batch.id)
          .single()

        const currentRem = currentDbStock?.remaining_quantity ?? item.batch.remaining_quantity
        const newRemaining = Math.max(0, currentRem - totalEggsSold)

        await supabase.from('user_issued_stocks').update({ remaining_quantity: newRemaining }).eq('id', item.batch.id)
      }

      if (custObj && paymentType === 'credit') {
        await supabase.from('customers').update({
          credit_balance: Number(custObj.credit_balance || 0) + netTotalAmount
        }).eq('id', custObj.id)
      }

      setReceipt({
        saleId: sale.id,
        items: [...cart],
        totalAmount: netTotalAmount,
        cashPaid: paymentType === 'cash' ? cash : 0,
        balance: paymentType === 'cash' ? Math.max(0, cash - netTotalAmount) : 0,
        date: new Date().toLocaleString(),
        customerName: custObj?.name,
        paymentType,
        damagedDiscount: totalDamagedDiscount
      })

      clearCart()
      setSelectedCustomer('')
      setPaymentType('cash')
      if (currentUser) {
        await fetchMyIssuedStock(currentUser.email)
        await fetchMySalesHistory()
      }
      fetchCustomers()
    } catch (err: any) {
      alert('Checkout Error: ' + err.message)
    } finally {
      setCheckoutLoading(false)
    }
  }

  const handleDeleteSale = async (sale: any) => {
    const inputPass = prompt(`ඔබට විශ්වාසද #SALE-${sale.id} බිල්පත මකා දැමීමට අවශ්‍ය බව? කරුණාකර Admin මුරපදය ඇතුළත් කරන්න:`)
    if (inputPass !== ADMIN_DELETE_PASSWORD) {
      return alert("ඇතුළත් කළ මුරපදය වැරදියි! බිල්පත මකා දැමීමට අවසර නැත.")
    }

    try {
      for (const item of sale.sale_items || []) {
        const { data: stockData } = await supabase
          .from('user_issued_stocks')
          .select('*')
          .ilike('user_email', currentUser?.email?.trim() || '')
          .eq('batch_id', item.batch_id)
          .single()

        if (stockData) {
          await supabase.from('user_issued_stocks').update({
            remaining_quantity: stockData.remaining_quantity + Number(item.quantity_eggs)
          }).eq('id', stockData.id)
        }
      }

      if (sale.payment_type === 'credit' && sale.customer_id) {
        const { data: cust } = await supabase.from('customers').select('credit_balance').eq('id', sale.customer_id).single()
        if (cust) {
          await supabase.from('customers').update({
            credit_balance: Math.max(0, cust.credit_balance - Number(sale.total_amount))
          }).eq('id', sale.customer_id)
        }
      }

      await supabase.from('sale_items').delete().eq('sale_id', sale.id)
      await supabase.from('sales').delete().eq('id', sale.id)

      alert('බිල්පත සාර්ථකව මකා දමන ලදී! ශේෂයන් නැවත යාවත්කාලීන විය.')
      if (currentUser) {
        fetchMyIssuedStock(currentUser.email)
        fetchMySalesHistory()
      }
    } catch (err: any) {
      alert('Error deleting sale: ' + err.message)
    }
  }

  const fetchReports = async (targetDate?: string) => {
    const dateToUse = targetDate || selectedReportDate
    const startDate = `${dateToUse}T00:00:00.000Z`
    const endDate = `${dateToUse}T23:59:59.999Z`

    const { data } = await supabase
      .from('sales')
      .select(`
        id, created_at, payment_type, total_amount, user_email,
        sale_items ( quantity_eggs, unit_price, damaged_qty, egg_batches ( item_name, purchase_price ) )
      `)
      .gte('created_at', startDate)
      .lte('created_at', endDate)

    if (data) {
      let dayRev = 0, dayCost = 0, dayDamaged = 0
      const itemMap: { [key: string]: { qty: number; rev: number } } = {}
      const userMap: { [key: string]: { qty: number; rev: number } } = {}

      data.forEach((sale: any) => {
        const user = sale.user_email || 'Unknown User'
        if (!userMap[user]) userMap[user] = { qty: 0, rev: 0 }

        let saleTotalRev = 0

        sale.sale_items?.forEach((item: any) => {
          const qty = Number(item.quantity_eggs) || 0
          const sellPrice = Number(item.unit_price) || 0
          const buyPrice = Number(item.egg_batches?.purchase_price) || 0
          const damaged = Number(item.damaged_qty) || 0
          const name = item.egg_batches?.item_name || 'Egg Batch'

          const itemRevenue = (sellPrice * qty) - (damaged * sellPrice)
          const itemCost = buyPrice * qty

          dayRev += itemRevenue
          dayCost += itemCost
          dayDamaged += damaged
          saleTotalRev += itemRevenue

          if (!itemMap[name]) itemMap[name] = { qty: 0, rev: 0 }
          itemMap[name].qty += qty
          itemMap[name].rev += itemRevenue

          userMap[user].qty += qty
        })

        userMap[user].rev += Number(sale.total_amount) || saleTotalRev
      })

      setTodayRevenue(dayRev)
      setTodayProfit(dayRev - dayCost)
      setTotalDamagedEggs(dayDamaged)

      setItemSummaries(Object.keys(itemMap).map(key => ({
        itemName: key,
        qtySold: itemMap[key].qty,
        revenue: itemMap[key].rev
      })))

      setUserReportSummaries(Object.keys(userMap).map(key => ({
        userEmail: key,
        qtySold: userMap[key].qty,
        revenue: userMap[key].rev
      })))
    }
  }

  // ==========================================
  // EXCEL EXPORT FUNCTION (නව පහසුකම)
  // ==========================================
  const handleExportExcel = async () => {
    const startDate = `${selectedReportDate}T00:00:00.000Z`
    const endDate = `${selectedReportDate}T23:59:59.999Z`

    // 1. තෝරාගත් දිනයට අදාළ Sales Fetch කිරීම
    const { data: salesData } = await supabase
      .from('sales')
      .select(`
        id, created_at, payment_type, total_amount, user_email,
        sale_items ( quantity_eggs, unit_price, damaged_qty, egg_batches ( item_name ) )
      `)
      .gte('created_at', startDate)
      .lte('created_at', endDate)

    // 2. තෝරාගත් දිනයට අදාළ User Issued Stocks Fetch කිරීම
    const { data: issuedStocksData } = await supabase
      .from('user_issued_stocks')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate)

    // Excel Sheet 1: Daily User Sales & Stock Allocation Report
    const userReportHeader = [
      ["දෛනික පරිශීලක අලෙවි සහ තොග වාර්තාව (Daily User Sales & Stock Allocation)"],
      [`දිනය (Date): ${selectedReportDate}`],
      [""],
      ["පරිශීලක Email", "බිත්තර වර්ගය", "ලබාගත් ප්‍රමාණය", "විකුණන ලද ප්‍රමාණය", "ඉතිරි ශේෂය", "ඒකකයක මිළ (Rs.)", "මුළු ආදායම (Rs.)"]
    ]

    const userReportRows: any[] = []

    // පරිශීලකයන් සහ බිත්තර වර්ග අනුව දත්ත සකස් කිරීම
    const userStockMap: { [key: string]: { [batchName: string]: { issued: number; sold: number; price: number } } } = {}

    // Issued Stock සිතියම්ගත කිරීම
    issuedStocksData?.forEach((st: any) => {
      const email = st.user_email || 'Unknown'
      const batchName = st.batch_name || 'Egg'
      if (!userStockMap[email]) userStockMap[email] = {}
      if (!userStockMap[email][batchName]) userStockMap[email][batchName] = { issued: 0, sold: 0, price: 0 }
      userStockMap[email][batchName].issued += Number(st.issued_quantity) || 0
    })

    // Sales දත්ත සිතියම්ගත කිරීම
    salesData?.forEach((sale: any) => {
      const email = sale.user_email || 'Unknown'
      if (!userStockMap[email]) userStockMap[email] = {}

      sale.sale_items?.forEach((item: any) => {
        const batchName = item.egg_batches?.item_name || 'Egg'
        const qty = Number(item.quantity_eggs) || 0
        const price = Number(item.unit_price) || 0

        if (!userStockMap[email][batchName]) userStockMap[email][batchName] = { issued: 0, sold: 0, price: price }
        userStockMap[email][batchName].sold += qty
        userStockMap[email][batchName].price = price
      })
    })

    let rowIndex = 5 // Excel Row Start Index
    Object.keys(userStockMap).forEach((userEmail) => {
      Object.keys(userStockMap[userEmail]).forEach((bName) => {
        const info = userStockMap[userEmail][bName]
        const r = rowIndex

        userReportRows.push([
          userEmail,
          bName,
          info.issued,
          info.sold,
          { f: `C${r}-D${r}` },           // ශේෂය = ගෙනගිය - විකුණූ
          info.price,
          { f: `D${r}*F${r}` }            // මුළු මුදල = විකුණූ x මිළ
        ])
        rowIndex++
      })
    })

    // Total Row
    userReportRows.push([
      "මුළු එකතුව (Total)",
      "",
      { f: `SUM(C5:C${rowIndex - 1})` },
      { f: `SUM(D5:D${rowIndex - 1})` },
      { f: `SUM(E5:E${rowIndex - 1})` },
      "",
      { f: `SUM(G5:G${rowIndex - 1})` }
    ])

    // Excel Sheet 2: Main Stock Summary Sheet
    const stockReportHeader = [
      ["ප්‍රධාන ගබඩා තොග වාර්තාව (Main Stock Summary)"],
      [`වාර්තාගත දිනය: ${selectedReportDate}`],
      [""],
      ["බිත්තර වර්ගය", "ගැනුම් මිළ (Rs.)", "විකුණුම් මිළ (Rs.)", "ගබඩාවේ ඇති මුළු ප්‍රමාණය", "විකිණීමට ඉතිරි ප්‍රමාණය", "තොගයේ මුළු වටිනාකම (Rs.)"]
    ]

    const stockReportRows: any[] = []
    let stockRowIndex = 5

    mainBatches.forEach((b) => {
      const r = stockRowIndex
      stockReportRows.push([
        b.item_name,
        b.purchase_price,
        b.selling_price,
        b.quantity,
        b.remaining_quantity,
        { f: `E${r}*B${r}` } // වටිනාකම = ඉතිරි ප්‍රමාණය x ගැනුම් මිළ
      ])
      stockRowIndex++
    })

    stockReportRows.push([
      "මුළු එකතුව (Total)",
      "",
      "",
      { f: `SUM(D5:D${stockRowIndex - 1})` },
      { f: `SUM(E5:E${stockRowIndex - 1})` },
      { f: `SUM(F5:F${stockRowIndex - 1})` }
    ])

    // Excel Workbook සෑදීම
    const wb = XLSX.utils.book_new()

    const wsUserSales = XLSX.utils.aoa_to_sheet([...userReportHeader, ...userReportRows])
    const wsMainStock = XLSX.utils.aoa_to_sheet([...stockReportHeader, ...stockReportRows])

    XLSX.utils.book_append_sheet(wb, wsUserSales, "User Sales & Stock")
    XLSX.utils.book_append_sheet(wb, wsMainStock, "Main Stock Report")

    // File එක Download කිරීම
    XLSX.writeFile(wb, `Egg_POS_Report_${selectedReportDate}.xlsx`)
  }

  if (authLoading) return <div className="min-h-screen flex items-center justify-center font-bold">Loading...</div>

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-200 p-4">
        <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
          <h1 className="text-2xl font-bold text-center text-blue-900 mb-6">🥚 Egg POS Login</h1>
          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold mb-1">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full p-2 border rounded" placeholder="user@example.com" />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full p-2 border rounded" placeholder="••••••••" />
            </div>
            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded">Sign In</button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen p-6 bg-gray-100 text-gray-800">
      {/* Receipt Modal */}
      {receipt && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50 p-4">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-sm border font-mono">
            <div className="text-center border-b pb-3 mb-3">
              <h2 className="text-xl font-bold">🥚 EGG POS SHOP</h2>
              <p className="text-xs text-gray-500">{receipt.date}</p>
              <p className="text-xs font-semibold">Receipt: #SALE-{receipt.saleId}</p>
              {receipt.customerName && <p className="text-xs text-blue-600 font-bold mt-1">Customer: {receipt.customerName}</p>}
            </div>

            <div className="border-b pb-3 mb-3 text-sm space-y-2">
              {receipt.items.map((item, idx) => (
                <div key={idx} className="flex justify-between">
                  <div>
                    <span>{item.batch.batch_name} ({item.sellType === 'box' ? `Box x${item.quantity}` : `Single x${item.quantity}`})</span>
                    {item.damagedExchangeQty > 0 && <p className="text-xs text-red-500">Damaged Return: {item.damagedExchangeQty} eggs</p>}
                  </div>
                  <span>Rs. {(item.sellType === 'box' ? item.sellingPrice * item.eggsPerBox : item.sellingPrice) * item.quantity}</span>
                </div>
              ))}
            </div>

            {receipt.damagedDiscount > 0 && (
              <div className="flex justify-between text-xs text-red-600 font-bold border-b pb-2 mb-2">
                <span>Damaged Discount:</span>
                <span>- Rs. {receipt.damagedDiscount}</span>
              </div>
            )}

            <div className="text-sm space-y-1 font-bold border-b pb-3 mb-3">
              <div className="flex justify-between">
                <span>NET TOTAL:</span>
                <span className="text-blue-600">Rs. {receipt.totalAmount}</span>
              </div>
              {receipt.paymentType === 'cash' && (
                <>
                  <div className="flex justify-between text-xs">
                    <span>CASH PAID:</span>
                    <span>Rs. {receipt.cashPaid}</span>
                  </div>
                  <div className="flex justify-between text-xs text-green-600">
                    <span>BALANCE:</span>
                    <span>Rs. {receipt.balance}</span>
                  </div>
                </>
              )}
            </div>

            <div className="flex gap-2">
              <button onClick={() => window.print()} className="flex-1 bg-blue-600 text-white font-bold py-2 rounded">🖨️ Print</button>
              <button onClick={() => setReceipt(null)} className="bg-gray-300 text-gray-800 font-bold px-4 py-2 rounded">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Sale Detail Modal */}
      {selectedSaleDetail && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50 p-4">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md border">
            <h3 className="text-lg font-bold border-b pb-2 mb-3">🧾 බිල්පත් විස්තරය (#SALE-{selectedSaleDetail.id})</h3>
            <p className="text-xs text-gray-500 mb-2">දිනය: {new Date(selectedSaleDetail.created_at).toLocaleString()}</p>
            <p className="text-xs font-bold mb-3">ගෙවීම් ආකාරය: <span className="uppercase text-blue-600">{selectedSaleDetail.payment_type}</span></p>

            <div className="space-y-2 border-t border-b py-3 text-sm">
              {selectedSaleDetail.sale_items?.map((item: any, i: number) => (
                <div key={i} className="flex justify-between border-b pb-1">
                  <div>
                    <p className="font-semibold">{item.egg_batches?.item_name || 'Egg'}</p>
                    <p className="text-xs text-gray-500">{item.quantity_eggs} eggs x Rs. {item.unit_price}</p>
                    {item.damaged_qty > 0 && <p className="text-xs text-red-500 font-bold">නරක් වූ බිත්තර: {item.damaged_qty}</p>}
                  </div>
                  <span className="font-bold">Rs. {item.total_amount}</span>
                </div>
              ))}
            </div>

            <div className="flex justify-between font-bold text-base my-3">
              <span>එකතුව:</span>
              <span className="text-blue-600">Rs. {selectedSaleDetail.total_amount}</span>
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => handleDeleteSale(selectedSaleDetail).then(() => setSelectedSaleDetail(null))} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded font-bold text-xs">🔒 🗑️ මකා දමන්න (Password Required)</button>
              <button onClick={() => setSelectedSaleDetail(null)} className="bg-gray-300 text-gray-800 px-4 py-2 rounded font-bold text-xs">වසා දමන්න</button>
            </div>
          </div>
        </div>
      )}

      {/* Top Header */}
      <div className="max-w-7xl mx-auto mb-6 flex flex-col sm:flex-row justify-between items-center bg-white p-4 rounded-lg shadow border">
        <div>
          <h1 className="text-2xl font-bold text-blue-900">🥚 Egg POS System</h1>
          <p className="text-xs text-gray-500">Logged User: <span className="font-bold text-blue-600">{currentUser.email}</span> ({currentUser.role.toUpperCase()})</p>
        </div>

        <div className="flex gap-2 flex-wrap mt-4 sm:mt-0">
          <button onClick={() => setActiveTab('sales')} className={`px-4 py-2 font-bold rounded-lg ${activeTab === 'sales' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>🛒 My Sales</button>
          <button onClick={() => setActiveTab('my_history')} className={`px-4 py-2 font-bold rounded-lg ${activeTab === 'my_history' ? 'bg-indigo-600 text-white' : 'bg-gray-100'}`}>📋 මගේ දෛනික වාර්තා & බිල්පත්</button>
          {currentUser.role === 'admin' && (
            <>
              <button onClick={() => setActiveTab('issue')} className={`px-4 py-2 font-bold rounded-lg ${activeTab === 'issue' ? 'bg-amber-600 text-white' : 'bg-gray-100'}`}>🚚 Issue Stock</button>
              <button onClick={() => setActiveTab('stock')} className={`px-4 py-2 font-bold rounded-lg ${activeTab === 'stock' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>📦 Main Stock</button>
              <button onClick={() => setActiveTab('reports')} className={`px-4 py-2 font-bold rounded-lg ${activeTab === 'reports' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>📊 Admin Reports</button>
              <button onClick={() => setActiveTab('users')} className={`px-4 py-2 font-bold rounded-lg ${activeTab === 'users' ? 'bg-purple-600 text-white' : 'bg-gray-100'}`}>👤 Add Users</button>
            </>
          )}
          <button onClick={() => setActiveTab('customers')} className={`px-4 py-2 font-bold rounded-lg ${activeTab === 'customers' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>👥 Customers</button>
          <button onClick={handleLogout} className="px-4 py-2 font-bold rounded-lg bg-red-500 text-white">Logout</button>
        </div>
      </div>

      {/* Tab 1: Sales Terminal */}
      {activeTab === 'sales' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
          <div className="lg:col-span-2">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">ඔබ වෙත ලබාදී ඇති බිත්තර තොග (My Issued Stock)</h2>
              <button onClick={() => fetchMyIssuedStock(currentUser.email)} className="bg-gray-200 hover:bg-gray-300 px-3 py-1 text-xs font-bold rounded">🔄 Reload Stock</button>
            </div>
            {myIssuedStock.length === 0 ? (
              <div className="bg-white p-6 rounded-lg text-center border text-gray-500">ඔබට අද දින සඳහා Admin විසින් තවම තොග නිකුත් කර නොමැත.</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {myIssuedStock.map((stock) => {
                  const mainBatch = mainBatches.find(b => b.id === stock.batch_id)
                  const boxSize = mainBatch?.eggs_per_box || 300
                  const sellPrice = mainBatch?.selling_price || 0

                  return (
                    <div key={stock.id} className="bg-white p-5 rounded-lg shadow border flex flex-col justify-between">
                      <div>
                        <h3 className="text-lg font-bold">{stock.batch_name}</h3>
                        <p className="text-xs text-gray-400">Issued Date: {new Date(stock.date).toLocaleDateString()}</p>
                        <p className="text-green-600 font-bold text-lg my-1">Rs. {sellPrice} <span className="text-xs text-gray-500">(එකක්)</span></p>
                        <p className="text-sm font-bold text-amber-600 mt-2">ඔබට ලැබුණු ප්‍රමාණය: {stock.issued_quantity}</p>
                        <p className="text-sm font-bold text-blue-600">විකිණීමට ඉතිරි: {stock.remaining_quantity} eggs</p>
                      </div>
                      <div className="flex gap-2 mt-4">
                        <button onClick={() => addToCart(stock, 'single')} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded text-xs">+ Single Egg</button>
                        <button onClick={() => addToCart(stock, 'box')} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded text-xs">+ Box ({boxSize})</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Cart Section */}
          <div className="bg-white p-6 rounded-lg shadow border flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center border-b pb-2 mb-4">
                <h2 className="text-xl font-bold">Cart</h2>
                {cart.length > 0 && (
                  <button onClick={clearCart} className="text-xs bg-red-100 hover:bg-red-200 text-red-700 font-bold px-2 py-1 rounded">
                    🗑️ Clear Cart
                  </button>
                )}
              </div>

              {cart.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">Cart එක හිස්ව පවතී</div>
              ) : (
                <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                  {cart.map((item, idx) => {
                    const lineTotal = (item.sellType === 'box' ? item.sellingPrice * item.eggsPerBox : item.sellingPrice) * item.quantity
                    return (
                      <div key={idx} className="bg-gray-50 p-3 rounded border text-xs space-y-2">
                        <div className="flex justify-between font-bold">
                          <span>{item.batch.batch_name} ({item.sellType.toUpperCase()})</span>
                          <span>Rs. {lineTotal}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1">
                            <span className="text-gray-500">Qty:</span>
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => updateQuantity(item.batch.id, item.sellType, parseInt(e.target.value) || 0, item.damagedExchangeQty)}
                              className="w-14 p-1 border rounded text-center font-bold"
                            />
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-red-500 font-bold">Damaged:</span>
                            <input
                              type="number"
                              min="0"
                              value={item.damagedExchangeQty}
                              onChange={(e) => updateQuantity(item.batch.id, item.sellType, item.quantity, parseInt(e.target.value) || 0)}
                              className="w-14 p-1 border rounded text-center font-bold text-red-600"
                            />
                          </div>
                          <button onClick={() => updateQuantity(item.batch.id, item.sellType, 0)} className="text-red-600 font-bold text-base px-1">✕</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="mt-6 border-t pt-4 space-y-3">
              <div className="space-y-1 text-sm font-semibold">
                <div className="flex justify-between"><span>subtotal:</span><span>Rs. {rawTotalAmount}</span></div>
                {totalDamagedDiscount > 0 && <div className="flex justify-between text-red-600"><span>Damaged Discount:</span><span>- Rs. {totalDamagedDiscount}</span></div>}
                <div className="flex justify-between text-base font-bold border-t pt-1 text-blue-900"><span>NET TOTAL:</span><span>Rs. {netTotalAmount}</span></div>
              </div>

              <div className="space-y-2 text-xs">
                <div>
                  <label className="block font-bold mb-1">ගෙවීම් ආකාරය (Payment Type)</label>
                  <select value={paymentType} onChange={(e: any) => setPaymentType(e.target.value)} className="w-full p-2 border rounded font-semibold bg-gray-50">
                    <option value="cash">Cash (මුදලින්)</option>
                    <option value="credit">Credit (ණයට)</option>
                  </select>
                </div>

                {paymentType === 'credit' ? (
                  <div>
                    <label className="block font-bold mb-1">Customer (පාරිභෝගිකයා තෝරන්න)</label>
                    <select value={selectedCustomer} onChange={(e) => setSelectedCustomer(e.target.value)} className="w-full p-2 border rounded bg-gray-50">
                      <option value="">-- Customer තෝරන්න --</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>{c.name} ({c.phone || 'No phone'}) - Balance: Rs.{c.credit_balance}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block font-bold mb-1">ගෙවූ මුදල (Cash Paid)</label>
                    <input
                      type="number"
                      value={cashPaid}
                      onChange={(e) => setCashPaid(e.target.value)}
                      placeholder="e.g. 5000"
                      className="w-full p-2 border rounded font-bold text-sm"
                    />
                    <p className="text-right text-green-600 font-bold mt-1">ඉතිරි (Balance): Rs. {calculatedBalance}</p>
                  </div>
                )}
              </div>

              <button
                onClick={handleCheckout}
                disabled={checkoutLoading || cart.length === 0}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-lg shadow transition disabled:opacity-50"
              >
                {checkoutLoading ? 'Processing...' : '💳 Complete Checkout & Print'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: My Sales History */}
      {activeTab === 'my_history' && (
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-lg border shadow">
              <p className="text-xs text-gray-500 font-bold uppercase">අද දින එකතු වූ මුදල (Cash in Hand)</p>
              <h3 className="text-2xl font-black text-green-600 mt-1">Rs. {myTodayCashInHand}</h3>
            </div>
            <div className="bg-white p-5 rounded-lg border shadow">
              <p className="text-xs text-gray-500 font-bold uppercase">අද විකුණූ මුළු බිත්තර ගණන</p>
              <h3 className="text-2xl font-black text-blue-600 mt-1">{myTodayEggsSold} eggs</h3>
            </div>
            <div className="bg-white p-5 rounded-lg border shadow">
              <p className="text-xs text-gray-500 font-bold uppercase">අද මාරු කළ නරක් වූ බිත්තර</p>
              <h3 className="text-2xl font-black text-red-600 mt-1">{myTodayDamagedEggs} eggs</h3>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border shadow">
            <h2 className="text-lg font-bold mb-4">මගේ බිල්පත් ඉතිහාසය (Sales History)</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b bg-gray-50 text-gray-600 font-bold uppercase">
                    <th className="p-3">Bill ID</th>
                    <th className="p-3">දිනය</th>
                    <th className="p-3">පාරිභෝගිකයා</th>
                    <th className="p-3">ගෙවීම් ක්‍රමය</th>
                    <th className="p-3">මුදල</th>
                    <th className="p-3 text-right">ක්‍රියාමාර්ග</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {mySales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-gray-50">
                      <td className="p-3 font-bold">#SALE-{sale.id}</td>
                      <td className="p-3">{new Date(sale.created_at).toLocaleString()}</td>
                      <td className="p-3">{sale.customers?.name || 'Walk-in Customer'}</td>
                      <td className="p-3"><span className="uppercase font-bold text-blue-600">{sale.payment_type}</span></td>
                      <td className="p-3 font-bold">Rs. {sale.total_amount}</td>
                      <td className="p-3 text-right space-x-2">
                        <button onClick={() => setSelectedSaleDetail(sale)} className="bg-blue-100 text-blue-700 px-3 py-1 rounded font-bold">විස්තර / 🗑️ Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Admin Issue Stock */}
      {activeTab === 'issue' && currentUser.role === 'admin' && (
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="bg-white p-6 rounded-lg border shadow">
            <h2 className="text-lg font-bold mb-4">🚚 Users / Drivers වෙත බිත්තර නිකුත් කිරීම</h2>
            <form onSubmit={handleIssueStockToUser} className="grid grid-cols-1 sm:grid-cols-5 gap-4">
              <div>
                <label className="block text-xs font-bold mb-1">User තෝරන්න</label>
                <select value={selectedUserEmail} onChange={(e) => setSelectedUserEmail(e.target.value)} className="w-full p-2 border rounded text-xs bg-gray-50">
                  <option value="">-- Select User --</option>
                  {userList.map((u) => <option key={u.id} value={u.email}>{u.email} ({u.role})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">ප්‍රධාන Batch එක</label>
                <select value={selectedMainBatchId} onChange={(e) => setSelectedMainBatchId(e.target.value)} className="w-full p-2 border rounded text-xs bg-gray-50">
                  <option value="">-- Select Batch --</option>
                  {mainBatches.map((b) => <option key={b.id} value={b.id}>{b.item_name} (ඉතිරි: {b.remaining_quantity})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">බිත්තර ගණන</label>
                <input type="number" value={issueQty} onChange={(e) => setIssueQty(e.target.value)} placeholder="e.g. 1500" className="w-full p-2 border rounded text-xs font-bold" />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">නිකුත් කරන දිනය (Issue Date)</label>
                <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className="w-full p-2 border rounded text-xs font-bold" />
              </div>
              <div className="flex items-end">
                <button type="submit" className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold p-2 rounded text-xs">ලබාදෙන්න (Issue Stock)</button>
              </div>
            </form>
          </div>

          <div className="bg-white p-6 rounded-lg border shadow">
            <h2 className="text-lg font-bold mb-4">සියලුම Users වෙත නිකුත් කර ඇති තොග විස්තර</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b bg-gray-50 font-bold uppercase">
                    <th className="p-3">නිකුත් කළ දිනය</th>
                    <th className="p-3">User Email</th>
                    <th className="p-3">Batch Name</th>
                    <th className="p-3">ලබාදුන් ප්‍රමාණය</th>
                    <th className="p-3">විකිණීමට ඉතිරි ප්‍රමාණය</th>
                    <th className="p-3 text-right">ක්‍රියාමාර්ග</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {allUserIssuedStocks.map((s) => (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="p-3 font-bold">{new Date(s.date).toLocaleDateString()}</td>
                      <td className="p-3 font-bold">{s.user_email}</td>
                      <td className="p-3">{s.batch_name}</td>
                      <td className="p-3 text-amber-600 font-bold">{s.issued_quantity}</td>
                      <td className="p-3 text-blue-600 font-bold">{s.remaining_quantity}</td>
                      <td className="p-3 text-right">
                        <button onClick={() => handleDeleteIssuedStock(s)} className="bg-red-100 hover:bg-red-200 text-red-700 font-bold px-3 py-1 rounded">🔒 🗑️ මකා දමන්න</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Main Stock Management */}
      {activeTab === 'stock' && currentUser.role === 'admin' && (
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="bg-white p-6 rounded-lg border shadow">
            <h2 className="text-lg font-bold mb-4">➕ ප්‍රධාන ගබඩාවට නව බිත්තර තොගයක් එකතු කිරීම</h2>
            <form onSubmit={handleAddBatch} className="grid grid-cols-1 sm:grid-cols-5 gap-4">
              <div>
                <label className="block text-xs font-bold mb-1">වර්ගය / නම</label>
                <input type="text" value={newBatchName} onChange={(e) => setNewBatchName(e.target.value)} required className="w-full p-2 border rounded text-xs" />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">ගැනුම් මිල (1 Egg)</label>
                <input type="number" value={newPurchasePrice} onChange={(e) => setNewPurchasePrice(e.target.value)} required placeholder="32" className="w-full p-2 border rounded text-xs font-bold" />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">විකුණුම් මිල (1 Egg)</label>
                <input type="number" value={newSellingPrice} onChange={(e) => setNewSellingPrice(e.target.value)} required placeholder="38" className="w-full p-2 border rounded text-xs font-bold" />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">පෙට්ටි (Boxes) ගණන</label>
                <input type="number" value={boxCount} onChange={(e) => setBoxCount(e.target.value)} required placeholder="10" className="w-full p-2 border rounded text-xs font-bold" />
              </div>
              <div className="flex items-end">
                <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold p-2 rounded text-xs">+ ගබඩාවට එකතු කරන්න</button>
              </div>
            </form>
          </div>

          <div className="bg-white p-6 rounded-lg border shadow">
            <h2 className="text-lg font-bold mb-4">ප්‍රධාන ගබඩාවේ දැනට ඇති තොග (Main Stock)</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {mainBatches.map((b) => (
                <div key={b.id} className="p-4 border rounded-lg bg-gray-50">
                  <h3 className="font-bold text-base">{b.item_name}</h3>
                  <p className="text-xs text-gray-500">ගැනුම් මිල: Rs.{b.purchase_price} | විකුණුම් මිල: Rs.{b.selling_price}</p>
                  <p className="text-sm font-bold text-blue-700 mt-2">ඉතිරි බිත්තර ගණන: {b.remaining_quantity} / {b.quantity}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Admin Reports (WITH EXCEL EXPORT BUTTON) */}
      {activeTab === 'reports' && currentUser.role === 'admin' && (
        <div className="max-w-7xl mx-auto space-y-6">
          
          {/* Date Selector & Export Excel Button Header */}
          <div className="bg-white p-4 rounded-lg border shadow flex flex-col sm:flex-row justify-between items-center gap-4">
            <div>
              <h2 className="font-bold text-lg text-blue-900">📊 Admin Daily Reports</h2>
              <p className="text-xs text-gray-500">දිනයට අදාළ ආදායම, පරිශීලකයන් සහ බිත්තර වර්ගීකරණ අලෙවි වාර්තා</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-gray-50 p-2 rounded border">
                <label className="text-xs font-bold text-gray-700">දිනය තෝරන්න:</label>
                <input 
                  type="date" 
                  value={selectedReportDate} 
                  onChange={(e) => {
                    setSelectedReportDate(e.target.value)
                    fetchReports(e.target.value)
                  }} 
                  className="p-2 border rounded text-xs font-bold bg-white text-gray-800"
                />
              </div>

              {/* EXCEL EXPORT BUTTON */}
              <button
                onClick={handleExportExcel}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-lg text-xs flex items-center gap-2 shadow"
              >
                📥 Export Excel (.xlsx)
              </button>
            </div>
          </div>

          {/* Daily Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-lg border shadow border-l-4 border-l-blue-600">
              <p className="text-xs font-bold text-gray-500 uppercase">එදින මුළු ආදායම & ශුද්ධ ලාභය</p>
              <h3 className="text-2xl font-bold text-blue-600 mt-1">Rs. {todayRevenue}</h3>
              <p className="text-xs font-bold text-emerald-600 mt-1">ශුද්ධ ලාභය (Net Profit): Rs. {todayProfit}</p>
            </div>

            <div className="bg-white p-5 rounded-lg border shadow border-l-4 border-l-amber-500">
              <p className="text-xs font-bold text-gray-500 uppercase">එදින විකුණන ලද මුළු බිත්තර ප්‍රමාණය</p>
              <h3 className="text-2xl font-bold text-amber-600 mt-1">
                {itemSummaries.reduce((sum, item) => sum + item.qtySold, 0)} eggs
              </h3>
            </div>

            <div className="bg-white p-5 rounded-lg border shadow border-l-4 border-l-red-500">
              <p className="text-xs font-bold text-gray-500 uppercase">නරක් වූ බිත්තර ප්‍රමාණය</p>
              <h3 className="text-2xl font-bold text-red-600 mt-1">{totalDamagedEggs} eggs</h3>
            </div>
          </div>

          {/* User-wise Table */}
          <div className="bg-white p-6 rounded-lg border shadow">
            <h3 className="font-bold text-base mb-3 text-gray-800 flex items-center gap-2">
              👤 පරිශීලකයා (User / Cashier) අනුව අලෙවිය සහ ආදායම
            </h3>
            {userReportSummaries.length === 0 ? (
              <p className="text-xs text-gray-500 py-4">තෝරාගත් දිනය සඳහා කිසිදු පරිශීලකයෙකුගේ විකුණුම් වාර්තා නොමැත.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b bg-gray-50 font-bold uppercase text-gray-600">
                      <th className="p-3">User Email</th>
                      <th className="p-3 text-center">විකුණන ලද බිත්තර ප්‍රමාණය</th>
                      <th className="p-3 text-right">එකතු වූ මුළු ආදායම</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {userReportSummaries.map((u, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="p-3 font-bold text-blue-600">{u.userEmail}</td>
                        <td className="p-3 text-center font-bold text-gray-700">{u.qtySold} eggs</td>
                        <td className="p-3 text-right font-bold text-green-600">Rs. {u.revenue}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Item-wise Table */}
          <div className="bg-white p-6 rounded-lg border shadow">
            <h3 className="font-bold text-base mb-3 text-gray-800 flex items-center gap-2">
              🥚 බිත්තර වර්ගය (Batch / Category) අනුව විකුණුම්
            </h3>
            {itemSummaries.length === 0 ? (
              <p className="text-xs text-gray-500 py-4">තෝරාගත් දිනය සඳහා බිත්තර විකුණුම් වාර්තා නොමැත.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b bg-gray-50 font-bold uppercase text-gray-600">
                      <th className="p-3">බිත්තර වර්ගය</th>
                      <th className="p-3 text-center">විකුණන ලද ප්‍රමාණය</th>
                      <th className="p-3 text-right">උපයන ලද ආදායම</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {itemSummaries.map((item, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="p-3 font-bold text-gray-800">{item.itemName}</td>
                        <td className="p-3 text-center font-bold text-gray-700">{item.qtySold} eggs</td>
                        <td className="p-3 text-right font-bold text-green-600">Rs. {item.revenue}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      )}

      {/* Tab 6: Customers */}
      {activeTab === 'customers' && (
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="bg-white p-6 rounded-lg border shadow">
            <h2 className="text-lg font-bold mb-4">➕ නව පාරිභෝගිකයෙකු එකතු කිරීම</h2>
            <form onSubmit={handleAddCustomer} className="flex gap-4">
              <input type="text" placeholder="නම" value={newCustName} onChange={(e) => setNewCustName(e.target.value)} required className="p-2 border rounded text-xs flex-1" />
              <input type="text" placeholder="දුරකථන අංකය" value={newCustPhone} onChange={(e) => setNewCustPhone(e.target.value)} className="p-2 border rounded text-xs flex-1" />
              <button type="submit" className="bg-blue-600 text-white font-bold px-4 py-2 rounded text-xs">+ එකතු කරන්න</button>
            </form>
          </div>

          <div className="bg-white p-6 rounded-lg border shadow">
            <h2 className="text-lg font-bold mb-4">පාරිභෝගික ලැයිස්තුව & ණය (Credit Balance)</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b bg-gray-50 font-bold uppercase">
                    <th className="p-3">නම</th>
                    <th className="p-3">දුරකථන අංකය</th>
                    <th className="p-3">ණය මුදල (Credit Balance)</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {customers.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="p-3 font-bold">{c.name}</td>
                      <td className="p-3">{c.phone || '-'}</td>
                      <td className="p-3 font-bold text-red-600">Rs. {c.credit_balance}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 7: Users Management */}
      {activeTab === 'users' && currentUser.role === 'admin' && (
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="bg-white p-6 rounded-lg border shadow">
            <h2 className="text-lg font-bold mb-4">👤 නව පරිශීලකයෙකු සෑදීම (Sign Up)</h2>
            <form onSubmit={handleAuth} className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required className="p-2 border rounded text-xs" />
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" required className="p-2 border rounded text-xs" />
              <select value={createRole} onChange={(e: any) => setCreateRole(e.target.value)} className="p-2 border rounded text-xs font-bold bg-gray-50">
                <option value="user">User / Driver</option>
                <option value="admin">Admin</option>
              </select>
              <button type="submit" onClick={() => setIsSignUp(true)} className="bg-purple-600 hover:bg-purple-700 text-white font-bold p-2 rounded text-xs">+ Register User</button>
            </form>
          </div>
        </div>
      )}
    </main>
  )
}