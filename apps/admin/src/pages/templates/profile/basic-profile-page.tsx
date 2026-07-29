import { Badge, Card, Descriptions, Divider, Table } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useNavigate } from 'react-router-dom'
import { PageHeaderWithBack } from '../../../shared/components/form-page-header'

type GoodItem = {
  id: string
  name?: string
  barcode?: string
  price?: string
  num: number
  amount: string
}

type ProgressItem = {
  key: string
  time: string
  rate: string
  status: 'success' | 'processing'
  operator: string
  cost: string
}

const basicGoods: GoodItem[] = [
  { id: '1234561', name: '矿泉水 550ml', barcode: '12421432143214321', price: '2.00', num: 2, amount: '4.00' },
  { id: '1234562', name: '凉茶 300ml', barcode: '12421432143214322', price: '3.00', num: 1, amount: '3.00' },
  { id: '1234563', name: '好吃的薯片', barcode: '12421432143214323', price: '7.00', num: 3, amount: '21.00' },
]

const totalGood: GoodItem = {
  id: '总计',
  num: basicGoods.reduce((sum, item) => sum + item.num, 0),
  amount: String(
    basicGoods
      .reduce((sum, item) => sum + Number(item.amount), 0)
      .toFixed(2)
  ),
}

const progressData: ProgressItem[] = [
  { key: '1', time: '2026-04-12 14:10', rate: '联系客户', status: 'success', operator: '取货员 ID1234', cost: '5分钟' },
  { key: '2', time: '2026-04-12 14:05', rate: '取货员出发', status: 'success', operator: '取货员 ID1234', cost: '1小时' },
  { key: '3', time: '2026-04-12 13:46', rate: '取货员接单', status: 'processing', operator: '调度系统', cost: '4分钟' },
  { key: '4', time: '2026-04-12 13:42', rate: '申请审批通过', status: 'success', operator: '系统', cost: '2分钟' },
]

const goodsColumns: ColumnsType<GoodItem> = [
  {
    title: '商品编号',
    dataIndex: 'id',
    key: 'id',
    width: 90,
    render: (_, record, index) => {
      if (index < basicGoods.length) return <span>{record.id}</span>
      return <span className="font-medium">总计</span>
    },
  },
  {
    title: '商品名称',
    dataIndex: 'name',
    key: 'name',
    width: 220,
    render: (_, record, index) => (index < basicGoods.length ? record.name : null),
  },
  {
    title: '商品条码',
    dataIndex: 'barcode',
    key: 'barcode',
    width: 120,
    render: (_, record, index) => (index < basicGoods.length ? record.barcode : null),
  },
  {
    title: '单价',
    dataIndex: 'price',
    key: 'price',
    width: 100,
    align: 'right',
    render: (_, record, index) => (index < basicGoods.length ? record.price : null),
  },
  {
    title: '数量（件）',
    dataIndex: 'num',
    key: 'num',
    width: 100,
    align: 'right',
    render: (_, record) => <span className="font-medium">{record.num}</span>,
  },
  {
    title: '金额',
    dataIndex: 'amount',
    key: 'amount',
    width: 100,
    align: 'right',
    render: (_, record) => <span className="font-medium">{record.amount}</span>,
  },
]

const progressColumns: ColumnsType<ProgressItem> = [
  { title: '时间', dataIndex: 'time', key: 'time', width: 120 },
  { title: '当前进度', dataIndex: 'rate', key: 'rate', width: 120 },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: 110,
    render: (value: ProgressItem['status']) =>
      value === 'success' ? <Badge status="success" text="成功" /> : <Badge status="processing" text="进行中" />,
  },
  { title: '操作员 ID', dataIndex: 'operator', key: 'operator', width: 90 },
  { title: '耗时', dataIndex: 'cost', key: 'cost', width: 120 },
]

export const BasicProfilePage = () => {
  const navigate = useNavigate()

  return (
    <div className="space-y-4">
      <PageHeaderWithBack title="详情页" onBack={() => navigate('/template/list/table')} />
      <Card variant="borderless">
        <Descriptions title="退款申请" className="mb-8">
        <Descriptions.Item label="取货单号">1000000000</Descriptions.Item>
        <Descriptions.Item label="状态">已取货</Descriptions.Item>
        <Descriptions.Item label="销售单号">1234123421</Descriptions.Item>
        <Descriptions.Item label="子订单">3214321432</Descriptions.Item>
      </Descriptions>

      <Divider className="mb-8" />

      <Descriptions title="用户信息" className="mb-8">
        <Descriptions.Item label="用户姓名">付小小</Descriptions.Item>
        <Descriptions.Item label="联系电话">18100000000</Descriptions.Item>
        <Descriptions.Item label="常用快递">菜鸟仓储</Descriptions.Item>
        <Descriptions.Item label="取货地址">浙江省杭州市西湖区万塘路18号</Descriptions.Item>
        <Descriptions.Item label="备注">无</Descriptions.Item>
      </Descriptions>

      <Divider className="mb-8" />

      <div className="mb-3.5 text-base font-medium">退货商品</div>
      <Table
        pagination={false}
        dataSource={[...basicGoods, totalGood]}
        columns={goodsColumns}
        rowKey="id"
        className="mb-6"
        scroll={{ x: 730 }}
      />

      <div className="mb-3.5 text-base font-medium">退货进度</div>
        <Table pagination={false} dataSource={progressData} columns={progressColumns} rowKey="key" scroll={{ x: 560 }} />
      </Card>
    </div>
  )
}
