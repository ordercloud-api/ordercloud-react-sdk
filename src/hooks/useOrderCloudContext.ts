import { useContext } from "react"
import { OrderCloudContext } from "../context"

const useOrderCloudContext = () => {
    return useContext(OrderCloudContext);
}

export default useOrderCloudContext;