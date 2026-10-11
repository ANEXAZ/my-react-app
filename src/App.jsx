import {useState} from "react";

function App() {
    const [orders, setOrders] = useState([]);

    const [id]

    const [customerName, setCustomerName] = useState("");
    const [productName, setProductName] = useState("");
    const [price, setPrice] = useState("");
    const [quantity, setQuantity] = useState("");

    function loadOrders() {
        fetch("http://localhost:8080/api/orders")
            .then((res) => res.json())
            .then((data) => setOrders(data));

    }



    function createOrder() {
        fetch("http://localhost:8080/api/orders", {
            method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({
                customerName: customerName,
                productName: productName,
                price: Number(price),
                quantity: Number(quantity)
            }),
        })
            .then((res) => res.json()).then(() => loadOrders())

    }
    function deleteOrder(){
        fetch("http://localhost:8080/api/orders",
            method: "DELETE", body:JSON.stringify({

        })

    }


    return (<div>
        <label>
            <input name="Customer Name"
                   placeholder="customer Name"
                   value={customerName}
                   onChange={(e) => setCustomerName(e.target.value)}
            />
            <input name="product name"
                   placeholder="product Name"
                   value={productName}
                   onChange={(e) => setProductName(e.target.value)}
            />
            <input name="price"
                   placeholder="price"
                   value={price}
                   onChange={(e) => setPrice(e.target.value)}
            />
            <input name="Quantity"
                   placeholder="quantity"
                   value={quantity}
                   onChange={(e) => setQuantity(e.target.value)}
            />
        </label>
        <button onClick={createOrder}>Create an Order</button>
        <button onClick={loadOrders}>Show all orders</button>
        <h1>My Orders</h1>
        <ul>
            {orders.map((order) => (<li key={order.id}>
                {order.createdDate}
                - {order.price}
                - {order.quantity}
                - {order.customerName}
                - {order.productName}
            </li>))}
        </ul>
    </div>);
}

export default App
